/**
 * SockJS wrapper with some semantic sugar to make it look more like
 * socket.io. Supports socket.emit and socket.on.  Based on:
 * http://simplapi.wordpress.com/2013/09/22/sockjs-on-steroids/
 *
 * @author jack@tinybike.net (Jack Peterson)
 */
var SOCKJSIO = (function (my, $) {    
    // Module exports
    var _exports = my._exports = my._exports || {};
    var _seal = my._seal = my._seal || function () {
        delete my._exports;
        delete my._seal;
        delete my._unseal;
    };    
    var _unseal = my._unseal = my._unseal || function () {
        my._exports = _exports;
        my._seal = _seal;
        my._unseal = _unseal;
    };

    var reconnected = 0;
    
    /**
     * @param namespace {String | null}
     */
    var sockjs = function (namespace) {
        // Store events list
        this._events = {};
        // The base url
        this._url = window.location.protocol + '//' + window.location.host;
        // Store the SockJS instance
        this._sockjs = null;
        // Store the namespace
        this._namespace = namespace || "";
        // Should reconnect or not
        this.reconnect = true;
        this.transports = [
            "websocket",
            "xhr-streaming",
            "iframe-eventsource",
            "iframe-htmlfile",
            "xhr-polling",
            "iframe-xhr-polling",
            "jsonp-polling"
        ];
        this.timeout = 10;
    };

    /**
     * Bind a function to an event from the server by matching the function
     *
     * to the message's "name" field.
     * @param name {String} Message type
     * @param fct {Function} Event callback function
     * @param scope {Object | null} Callback scope
     */
    sockjs.prototype.on = function (name, fct, scope) {
        var fn = fct;
        if (scope) {
            fn = function () {
                fct.apply(scope, arguments);
            };
        }

        // If it doesn't already exist, create
        if(!this._events[name]) {
            this._events[name] = [];
        }

        // Append event
        this._events[name].push(fct);
    };
    
    /**
     * Send a named message to the server.
     *
     * @param name {String} Message type
     * @param data {Object} Stringifiable, to be attached to the message
     */
    sockjs.prototype.emit = function (name, data) {
        var data;
        if (window.sid) {
            data = { name: name, data: data, sid: window.sid };
            if (this._sockjs.readyState == SockJS.OPEN) {
                if (typeof(data) === "string") {
                    this._sockjs.send(data);
                } else {
                    try {
                        this._sockjs.send(JSON.stringify(data));
                    } catch (e) {
                        console.error(e);
                        try {
                            this._sockjs.send(data.toString())
                        } catch (e) {
                            console.log("Unable to serialize data");
                            console.log(data);
                            console.error(e);
                        }
                    }
                }
            }
        }
    };
    
    /**
     * Connect to server
     */
    sockjs.prototype.connect = function () {
        
        // Disconnect previous instance
        if (reconnected > 10) {
            this.disconnect();
        }

        // Auto-reconnect
        if (this._sockjs) {
            var temp = this.reconnect;
            this.disconnect();
            this.reconnect = temp;
            reconnected += 1;
        }

        // Start new instance
        var socket_url = this._url + '/' + this._namespace;
        var sckt = new SockJS(socket_url);
        var _this = this;
        
        /**
         * Dispatch incoming message from the server.
         *
         * @param response {Object} incoming data from the server
         */
        function _catchEvent(response) {
            var parsed, func, f;
            if (response.type === "message" && response.data) {
                parsed = JSON.parse(response.data);
                func = _this._events[parsed.name];
                if (func && parsed.data.success) {
                    delete parsed.data.success;
                    for (var i = 0, len = func.length; i < len; ++i) {
                        f = func[i];
                        if (typeof(f) === "function") {
                            (function (callback) {
                                setTimeout(function () {
                                    callback(parsed.data);
                                }, 0);
                            })(f);
                        }
                    }
                }
            }
        };
        // Catch open
        sckt.onopen = function () {
            _catchEvent({
                name: "open",
                data : {}
            });
        };
        sckt.onmessage = function (data) {
            _catchEvent(data);
        };
        // Catch close, and reconnect
        sckt.onclose = function () {
            _catchEvent({
                name: "close",
                data : {}
            });
            if(_this.reconnect) {
                _this.connect();
            }
        };
        
        // Link to server
        this._sockjs = sckt;

        // Wait for ready signal
        this.readycheck();
    };
    
    /**
     * Ping the socket's readyState until it is open.
     */
    sockjs.prototype.readycheck = function () {
        var _this = this;
        if (this._sockjs.readyState != SockJS.OPEN) {
            setTimeout(function () { _this.readycheck(); }, this.timeout);
        } else {
            init_sockets();
        }
    };
    
    /**
     * Disconnect from server
     */
    sockjs.prototype.disconnect = function () {
        this.reconnect = false;
        if (!this._socket) {
            return;
        }
        this._socket.close();
        this._socket = null;
    };
    
    function init_sockets() {
        // sockets are open!  have at it :)
    }

    return _exports;

}(SOCKJSIO || {}, jQuery));
