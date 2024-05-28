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

            // request Shared attributes 
            const attributes = Array.from(Object.keys(app.attributes));
            app.logger.info(`mqtt requesting shared attributes: ${attributes}`);
            app['mqtt-thingsboard'].client.subscribe('v1/devices/me/attributes/response/+');
            app['mqtt-thingsboard'].client.publish('v1/devices/me/attributes/request/1', `{"sharedKeys":"${attributes}"}`);
            // subscribe to Shared attributes
            app['mqtt-thingsboard'].client.subscribe('v1/devices/me/attributes');

            // publish current Client attributtes
            app['mqtt-thingsboard'].client.publish(
                'v1/devices/me/attributes', JSON.stringify(app.attributes)
            );

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
        app.logger.debug(`mqtt topic ${topic.split('v1/devices/me/')[1]}`);

        if (topic === 'v1/devices/me/attributes/response/1') {
            // this is the first message requested on connect
            // const { shared } = JSON.parse(message);
            // console.log(shared);
            // attributesConfig(app, shared);
        } else if (topic === 'v1/devices/me/attributes') {
            try {
                attributesConfig(app, JSON.parse(message));
            } catch (err) {
                app.logger.info(`mqtt error ${err.message}`);
            }
        } else if (topic.includes('v1/devices/me/rpc/request/')) {
            // process RPC request
            rpcConfig(app, topic, message);
        }
    });
    
    // app['mqtt-thingsboard'].client.on('packetsend', () => {
    //     // Note: logging packet send is very verbose
    // });
};
