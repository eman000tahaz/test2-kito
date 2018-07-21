odoo.define('pos_kitchen.pos_synch', function (require) {
"use strict";

// var PosBaseWidget = require('point_of_sale.BaseWidget');
var PosDB = require('point_of_sale.DB');
var chrome = require('point_of_sale.chrome');
var gui = require('point_of_sale.gui');
var models = require('point_of_sale.models');

var core = require('web.core');
var Model = require('web.DataModel');
var PosSynch = new Model('pos.order.synch');

var QWeb = core.qweb;
var _t = core._t;

PosDB.include({
    init: function(options){
        this._super(options);
    },

    remove_order: function(order_id){
        this._super.apply(this, arguments);
        this.pos_synch_remove([order_id]);
    },

    pos_synch_update: function(action, orders){
        console.log('POS Synch - Update : ', action, _.pluck(orders, 'uid'));
        var self = this;
        if (action == 'add'){
            orders = _.filter(orders, function(order) {
                return order && order.lines.length;
            })
        }
        if (!orders.length){
            return $.when();
        }
        var json_orders = JSON.stringify(orders);
        return PosSynch.call('update_orders',
            [ action, json_orders],
        ).then(function (result) {
            console.log(' POS Order Synch Updated for ', _.pluck(orders, 'uid'));
            return;
        }).fail(function (error, event){
            event.preventDefault();
            console.error('Failed to send orders : ', _.pluck(orders, 'uid'));
            return;
        });
    },

    pos_synch_all: function(){
        console.log('POS Synch - All : ');
        return PosSynch.call('synch_all',
        ).then(function (result) {
            console.log('POS Order Synched All : ', result);
            return result;
        }).fail(function (error, event){
            event.preventDefault();
            console.error('Failed to Synch All');
        });
    },

    pos_synch_remove: function(order_uids){
        console.log('POS Synch - Remove : ', order_uids);
        if(!order_uids.length){
            return;
        }
        PosSynch.call('remove_order',
            [order_uids],
        ).then(function (result) {
            console.log('POS Order Synch Removed ', order_uids);
        }).fail(function (error, event){
            event.preventDefault();
            console.error('Failed to remove orders : ', order_uids);
        });
    },

    pos_synch_all_parsed: function(){
        var self = this;
        console.log('POS Synch - All - Parsing : ');
        return this.pos_synch_all().then(function(rows){
            var parsed_rows = [];

            console.log('___ rows : ', rows);

            _.each(rows, function(row){
                if(!row.data){
                    return;
                }
                var parsed_row = $.parseJSON(row.data);
                console.log('___ parsed_row : ', parsed_row);
                var orderlines = [];
                var prod_ids = _.keys(self.product_by_id);
                _.each(parsed_row.lines, function(line) {
                    console.log('______ line : ', line);
                    if(!line || !line.length == 3){
                        return;
                    }
                    var oline = line[2];
                    if(oline.state == 'done'){
                        return;
                    }
                    var prod_id = oline.product_id;
                    if(_.isObject(oline) && prod_id && $.inArray(prod_id, prod_ids)){
                        oline.product = self.product_by_id[prod_id];
                        orderlines.push(oline);
                    }
                });
                if(!orderlines.length){
                    return
                }
                if(parsed_row.partner_id){
                    parsed_row.partner = self.partner_by_id[parsed_row.partner_id];
                }
                orderlines = _.sortBy(orderlines, "id");
                parsed_row.orderlines = orderlines;
                var already_added = _.where(parsed_rows, {'uid': parsed_row.uid})
                if(!already_added.length){
                    parsed_rows.push(parsed_row);
                }
            });
            console.log('___  Synch - All - Parsed : ', parsed_rows);
            return parsed_rows;
        });
    },
    pos_orderline_state: function(uid, line_id, state){
        var self = this;
        console.log('POS Synch - Orderline State : ', uid, line_id, state);
        if(!uid || !line_id || !state){
            return;
        }
        return PosSynch.call('orderline_state',
            [uid, line_id, state],
        ).then(function (result) {
            return result;
        }).fail(function (error, event){
            event.preventDefault();
            console.error('Failed to POS Synch Orderline State : ', uid, state);
        });
    }
});

var _super_posmodel = models.PosModel;
models.PosModel = models.PosModel.extend({
    initialize: function(attributes, options){
        var self = this;
        _super_posmodel.prototype.initialize.apply(this, arguments);
        this.priority_by_key = _.extend({}, {
            'low': 'Low',
            'normal': 'Normal',
            'high': 'High',
        });
    },
    delete_current_order: function(){
        var order = this.get_order();
        this.db.pos_synch_remove([order.uid]);
        _super_posmodel.prototype.delete_current_order.apply(this, arguments);
    },
});

var _super_order = models.Order;
models.Order = models.Order.extend({
    initialize: function(attributes, options){
        _super_order.prototype.initialize.apply(this, arguments);
        this.priority = 'normal';
        this.priority_display = this.pos.priority_by_key[this.priority];
        this.order_to_kitchen = false;
    },
    set_priority: function(priority){
        this.priority = priority;
        // this.trigger('change',this);
        // this.update_to_kitchen();
    },
    get_priority: function(priority){
        return this.priority;
    },
    send_to_kitchen: function(){
        if(!this.orderlines.length){
            return;
        }
        this.update_to_kitchen();
    },
    update_to_kitchen: function(){
        var action = "add";
        if(this.order_to_kitchen){
            action = "update";
        }
        var order = this;
        var line_models = this.orderlines.models.filter(function(line){
            if (line.printable() && !line.order_to_kitchen){
                line.set_state('draft')
                return line;
            };
        });
        order.orderlines.models = line_models;
        order = order.export_as_JSON();
        console.log('___ order : ', order);
        this.pos.db.pos_synch_update(action, [order]);
    },
    remove_orderline: function( line ){
        _super_order.prototype.remove_orderline.apply(this, arguments);
        this.update_to_kitchen();
    },
    export_as_JSON: function(){
        var data = _super_order.prototype.export_as_JSON.apply(this, arguments);
        data.priority = this.priority;
        return data;
    },
    init_from_JSON: function(json) {
        this.priority = json.priority;
        _super_order.prototype.init_from_JSON.call(this, json);
    },
});

var _super_orderline = models.Orderline.prototype;
models.Orderline = models.Orderline.extend({
    initialize: function(attr, options) {
        _super_orderline.initialize.call(this,attr,options);
        this.state = this.state || "";
    },
    set_state: function(state){
        this.state = state;
        this.trigger('change',this);
    },
    get_state: function(state){
        return this.state;
    },
    can_be_merged_with: function(orderline) {
        if (this.state != orderline.state) {
            return false;
        } else {
            return _super_orderline.can_be_merged_with.apply(this,arguments);
        }
    },
    clone: function(){
        var orderline = _super_orderline.clone.call(this);
        orderline.state = this.state;
        return orderline;
    },
    export_as_JSON: function(){
        var json = _super_orderline.export_as_JSON.call(this);
        json.state = this.state;
        return json;
    },
    init_from_JSON: function(json){
        _super_orderline.init_from_JSON.apply(this,arguments);
        this.state = json.state;
    },
});

});
