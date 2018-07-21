odoo.define('pos_kitchen.kitchen', function (require) {
"use strict";

var PosBaseWidget = require('point_of_sale.BaseWidget');
var chrome = require('point_of_sale.chrome');
var gui = require('point_of_sale.gui');
var models = require('point_of_sale.models');
var screens = require('point_of_sale.screens');
var core = require('web.core');
var Model = require('web.DataModel');

var multiprint = require('pos_restaurant.multiprint');

var QWeb = core.qweb;
var _t = core._t;

var KitchenScreenWidget = screens.ScreenWidget.extend({
    template: 'KitchenScreenWidget',

    init: function(parent, options) {
        this._super(parent, options);
        this.order_update_ms = 5000;
        this.time_interval = false;
        this.order_interval = false;
        this.total_orders = -1;
        this.last_update_rows = [];
    },
    show: function(){
        var self = this;
        this._super();
        this.chrome.widget.order_selector.hide();
        self.order_interval = setInterval(function(){
            self.render_kitchen_orders().then(function(){
                self.time_interval = setInterval(function(){
                    self.loop_waiting_tm();
                }, 1000);
            });
        }, self.order_update_ms);
    },
    hide: function() {
        this.chrome.widget.order_selector.show();
        this._super();
        clearInterval(this.time_interval);
        clearInterval(this.order_interval);
    },
    click_back: function(){
        this.gui.show_screen('products');
    },
    render_kitchen_orders: function() {
        var self = this;
        var $dv_orders = this.$('.container-kitchen-orders');
        if(!$dv_orders.length){
            return;
        }
        return this.pos.db.pos_synch_all_parsed().then(function(rows) {
            var visible_rows = [];
            _.each(rows, function(row){
                var add = false;
                _.each(row.orderlines, function(line){
                    if(line.product){
                        add = true;
                        return;
                    }
                });
                if(add){
                    visible_rows.push(row);
                }
            });
            var bell = false;
            if(self.total_orders != -1 && self.total_orders < visible_rows.length){
                bell = true;
            }
            else {
                _.each(visible_rows, function(row){
                    var _torder = _.findWhere(self.last_update_rows, {'name': row.name});
                    if(!_torder){
                        return;
                    }
                    else if (_torder.orderlines.length < row.orderlines.length){
                        bell = true;
                        return;
                    }
                    _.each(row.orderlines, function(line) {
                        var _tline = _.findWhere(_torder.orderlines, {'id': line.id});
                        if (_tline && _tline.qty < line.qty){
                            bell = true;
                            return;
                        }
                    });
                    if(bell) {
                        return
                    }
                });
            }
            if (bell){
                self.gui.play_sound('tin');
            }
            self.total_orders = visible_rows.length;
            self.last_update_rows = visible_rows;
            var str_orders = $(QWeb.render('KitchenOrders', { 
                widget: self, 
                orders: visible_rows,
            }));
            $dv_orders.empty();
            $dv_orders.html(str_orders);
            var $btns = $dv_orders.find("button.k-state-btn");
            $btns.click(function(event) {
                var $elem = $(event.currentTarget);
                var data = $elem.data();
                $elem.addClass('active').siblings().removeClass('active');
                self.pos.db.pos_orderline_state(data.uid, data.id, data.state).then(function(){
                    if(data.state == "done"){
                        var $tr = $elem.parents('tr');
                        if($tr.siblings().length == 0){
                            $tr.parents('.kitchen-order').remove();
                            return;
                        }
                        $tr.remove();
                    }
                });
            });
        });
    },

    loop_waiting_tm: function(){
        var self = this;
        var $waiting_tms = this.$("div.js_waiting_tm");
        _.each($waiting_tms, function(dv_tm){
            var $dv_tm = $(dv_tm);
            if($dv_tm.length){
                var $dv = $dv_tm[0];
                var creation_date = $dv.dataset.creation_date;
                var format = "YYYY-MM-DD hh:mm:ss";
                var ms = moment(moment(), format).diff(creation_date, format);
                var duration = moment.duration(ms);

                var rem_tm = "";
                if (duration.hours() > 0){
                    rem_tm = duration.hours() + ":";
                }
                rem_tm += duration.minutes() + ':' + duration.seconds();
                $dv_tm.text(rem_tm);
            }
        });
    },

    renderElement: function() {
        var self = this;
        this._super();
        this.$('.back').click(function(){
            if (!self._locked) {
                self.click_back();
            }
        });
        this.$('.refresh').click(function() {
            if (!self._locked) {
                self.render_kitchen_orders();
            }
        });
        this.render_kitchen_orders();
    },
});

gui.define_screen({
    'name': 'kitchen',
    'widget': KitchenScreenWidget,
});

// Add the kitchen screen to the GUI, and set it as the default screen
chrome.Chrome.include({
    build_widgets: function(){
        this._super();
        if (this.pos.config.iface_is_kitchen) {
            this.gui.show_screen('kitchen');
        }
    },
});

// Show Kitchen View Button
var BtnKitchenView = screens.ActionButtonWidget.extend({
    template: 'BtnKitchenView',
    button_click: function(){
        this.gui.show_screen('kitchen');
    },
});

screens.define_action_button({
    'name': 'btn_kitchen_view',
    'widget': BtnKitchenView,
    'condition': function() {
        return this.pos.config.iface_btn_kitchen;
    }
});

// Cooking State
var OrderPrioritySelection = screens.ActionButtonWidget.extend({
    template: 'OrderPrioritySelection',
    button_click: function(){
        var order = this.pos.get_order();
        order.set_priority(this.el.value);
    },
});

screens.define_action_button({
    'name': 'popup_order_priority',
    'widget': OrderPrioritySelection,
});

PosBaseWidget.include({
    init:function(parent,options){
        var self = this;
        this._super(parent, options);
        if (this.gui && this.gui.screen_instances.products && this.gui.screen_instances.products.action_buttons.submit_order) {
            var submit_order = this.gui.screen_instances.products.action_buttons.submit_order;
            submit_order.button_click = function(){
                var order = this.pos.get_order();
                if(order.hasChangesToPrint()){
                    order.send_to_kitchen();
                    order.printChanges();
                    order.saveChanges();
                }
            };
        }
    },
});

screens.OrderWidget.include({
    renderElement: function(){
        var self = this;
        this._super();
        var order = this.pos.get_order();
        if (typeof order.get_priority == "function"){
            var order_priority = order.get_priority();
            $('.js_order_priority').val(order_priority);
        }
    },
});

});
