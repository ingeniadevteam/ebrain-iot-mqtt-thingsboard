'use strict';

const mqtt = require('mqtt');
const exitHook = require('async-exit-hook');

const attributesConfig = require('./attributes');
const rpcConfig = require('./rpc');

module.exports = (
    app,
    thingsboardHost = process.env.MQTT_HOSTNAME,
    accessToken = process.env.MQTT_ACCESS_TOKEN,
) => {
    const isGateway = process.env.GATEWAY === 'true';

    // Initialization of mqtt client using Thingsboard host and device access token
    app.logger.debug(`mqtt connecting to ${thingsboardHost}`);
    app['mqtt-thingsboard'].client = mqtt.connect('mqtt://' + thingsboardHost, {
        username: accessToken,
        keepalive: 10,
        reconnectPeriod: 15000
    });

    app['mqtt-thingsboard'].client.on('connect', success => {
        if (!success) {
            app.logger.error('mqtt connection failed');
            app['mqtt-thingsboard'].ready = false;
        } else {
            app.logger.info(`mqtt connected to ${thingsboardHost}`);
            app['mqtt-thingsboard'].ready = true;

            if (app.gateway) {
                Object.keys(app.gateway).forEach(device => {
                    app.logger.info(`mqtt device conncect: ${device}`);
                    app['mqtt-thingsboard'].client.publish('v1/gateway/connect', `{"device":"${device}"}`);
                });
            }

            // request shared "Device" attributes
            const attributes = Array.from(Object.keys(isGateway ? app.attributes.gateway : app.attributes));
            app.logger.info(`mqtt requesting shared attributes: ${attributes}`);
            app['mqtt-thingsboard'].client.subscribe('v1/devices/me/attributes/response/+');
            app['mqtt-thingsboard'].client.publish('v1/devices/me/attributes/request/1', `{"sharedKeys":"${attributes}"}`);
            
            // subscribe to Shared attributes
            app['mqtt-thingsboard'].client.subscribe('v1/devices/me/attributes');

            // request shared "Gateway" devices attributes
            if (isGateway) {
                const devices_attributes = { ...app.attributes };
                delete devices_attributes.gateway;                
                const attributes = Array.from(Object.keys(devices_attributes));
                app.logger.info(`mqtt requesting gateway devices attributes: ${attributes}`);
                for (const device of attributes) {
                    const keys = Object.keys(devices_attributes[device]).sort();
                    keys.forEach((key, id) => {
                        const message = { id, device, key, client: 1 };                        
                        app['mqtt-thingsboard'].client.publish('v1/gateway/attributes/request', JSON.stringify(message));                         
                    });                 
                }
            }

            // subscribe to RPC commands
            app['mqtt-thingsboard'].client.subscribe('v1/devices/me/rpc/request/+');

            // configure exit hook
            exitHook(() => {
                try {
                    if (app.gateway) {
                        Object.keys(app.gateway).forEach(device => {
                            app.logger.info(`mqtt device disconnect: ${device}`);
                            app['mqtt-thingsboard'].client.publish('v1/gateway/disconnect', `{"device":"${device}"}`);
                        });
                    }
                    app['mqtt-thingsboard'].client.end()
                } catch (e) {
                    console.error(`mqtt stop`, e.message);
                }
            });
        }
    });
    
    app['mqtt-thingsboard'].client.on('close', () => {
        app.logger.warn('mqtt connection closed');
        app['mqtt-thingsboard'].ready = false;
    });
    
    app['mqtt-thingsboard'].client.on('error', err => {
        app.logger.warn(`mqtt error ${err.message}`);
    });

    app['mqtt-thingsboard'].client.on('reconnect', () => {
        app['mqtt-thingsboard'].ready = true;
        app.logger.info(`mqtt reconnected`);
    })
    
    app['mqtt-thingsboard'].client.on('message', (topic, message) => {
        if (topic === 'v1/devices/me/attributes/response/1') {
            // this is the first message requested on connect           
            const { shared } = JSON.parse(message);
            attributesConfig(app, 'v1/devices/me/attributes', shared, isGateway);
        } else if (topic === 'v1/devices/me/attributes') {
            attributesConfig(app, topic, JSON.parse(message), isGateway);
        } else if (topic.includes('v1/devices/me/rpc/request/')) {
            rpcConfig(app, topic, message, isGateway);
        } else if (topic === 'v1/gateway/attributes') {
            attributesConfig(app, topic, JSON.parse(message), isGateway);
        } else if (topic === 'v1/gateway/attributes/response') {
            attributesConfig(app, topic, JSON.parse(message), isGateway);
        }
    });
    
    // app['mqtt-thingsboard'].client.on('packetsend', () => {
    //     // Note: logging packet send is very verbose
    // });
};
