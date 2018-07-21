odoo.define('pos_extra_product.additional_product', function (require) {
    "use strict";

var models = require('point_of_sale.models');
var screens = require('point_of_sale.screens');
var gui = require('point_of_sale.gui');
var core = require('web.core');
var PopupWidget = require('point_of_sale.popups');

var QWeb = core.qweb;
var _t = core._t;

var _super_orderline = models.Orderline.prototype;
models.Orderline = models.Orderline.extend({
    initialize: function(attr,options){
        this.extra_items = [];
        this.linked_product_ids = [];
        this.line_unit_price = 0;
        _super_orderline.initialize.apply(this,arguments);
    },
    set_extra_items: function(items) {
        var self = this;
        var order = this.pos.get_order();
        var orderlines = order.get_orderlines();
        var tot_price = this.product.price;
        this.line_unit_price = tot_price;
        this.set_unit_price(tot_price);
        _.each(items, function(prod){
            tot_price = tot_price + prod.price;
        });
        this.set_unit_price(tot_price);
        this.extra_items = items;
        this.trigger('change', this);
        this.order.trigger('change:sync');

        if(typeof this.order.send_to_kitchen == 'function'){
            self.order.send_to_kitchen();
        }
    },
    get_extra_items: function() {
        if (this.extra_items && this.extra_items.length) {
            return this.extra_items;
        }
        return [];
    },
    get_all_extra_products: function() {
        var self = this;
        if(this.product && this.product.extra_products.length){
            var products = _.each(this.product.extra_products, function(prod){
                if (!prod){
                    return;
                }
                var found = _.findWhere(self.extra_products, {id: prod.id});
                prod.active = false;
                if(found) {
                    prod.active = true;
                }
            });
            return products;
        }
        return [];
    },
    export_as_JSON: function() {
        var data = _super_orderline.export_as_JSON.apply(this, arguments);
        data.extra_items = this.extra_items;
        data.line_unit_price = this.line_unit_price;
        return data;
    },
    init_from_JSON: function(json) {
        this.extra_items = json.extra_items;
        this.line_unit_price = json.line_unit_price;
        _super_orderline.init_from_JSON.call(this, json);
    },
    clone: function(){
        var orderline = _super_orderline.clone.call(this);
        orderline.extra_items = this.extra_items;
        return orderline;
    },
});

var AdditionalItemButton = screens.ActionButtonWidget.extend({
    'template': 'AdditionalItemButton',
    button_click: function(){
        var self = this;
        var order = this.pos.get_order();
        var line = order.get_selected_orderline();
        if (line) {
            var _prods = line.get_all_extra_products();
            this.gui.show_popup('additional_items',{
                title: _('Additional Items'),
                items: _prods,
            });
        }
    },
});

screens.define_action_button({
    'name': 'additional_items',
    'widget': AdditionalItemButton,
});


var ProductAdditionalItems = PopupWidget.extend({
    template: 'AdditionalItemPopupWidget',
    show: function(options) {
        options = options || {};
        this._super(options);
        if (options.items) {
            this.events["click .prod_additional_item .button"] = "click_extra_item";
            this.items = options.items;
        }
        this.items.forEach(function(item) {
            item.active = false;
        });

        this.extra_items = options.extra_items || false;

        this.set_active_items();
        this.renderElement();
    },
    set_active_items: function() {
        if (!this.items) {
            return false;
        }
        var self = this;
        var order = this.pos.get_order();
        var line = order.get_selected_orderline();
        var extra_items = line.get_extra_items();

        if (extra_items && extra_items.length) {
            extra_items.forEach(function(item) {
                var exist_item = _.find(self.items, function(n) {
                    return item.id === n.id;
                });
                if (exist_item) {
                    exist_item.active = true;
                }
            });
        }
    },
    get_item_by_id: function(id) {
        return _.find(this.items, function(item) {
            return item.id === Number(id);
        });
    },
    click_extra_item: function(e) {
        var self = this;
        var id = e.currentTarget.getAttribute('data-id');
        self.set_active_note_status($(e.target), Number(id));
    },
    set_active_note_status: function(note_obj, id){
        if (note_obj.hasClass("active")) {
            note_obj.removeClass("active");
            this.get_item_by_id(id).active = false;
        } else {
            note_obj.addClass("active");
            this.get_item_by_id(id).active = true;
        }
    },
    click_confirm: function(){
        var self = this;
        var items = this.items.filter(function(item){
            return item.active === true;
        });
        var order = this.pos.get_order();
        var line = order.get_selected_orderline();
        line.set_extra_items(items);

        this.gui.close_popup();
    },
});
gui.define_popup({name:'additional_items', widget: ProductAdditionalItems});

});
