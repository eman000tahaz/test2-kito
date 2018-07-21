odoo.define('pos_custom.custom_light_option', function (require) {
"use strict";

var models = require('point_of_sale.models');
var Model = require('web.DataModel');
var screens = require('point_of_sale.screens');
var chrome = require('point_of_sale.chrome');
var PopupWidget = require('point_of_sale.popups');
var gui = require('point_of_sale.gui');
var core = require('web.core');

var QWeb = core.qweb;
var _t = core._t;

var Partner = _.find(models.PosModel.prototype.models, function(p){
    return p.model == 'res.partner';
});
Partner.fields.push('is_driver');

models.load_fields('restaurant.floor', 'default_order_type');


var BillScreenWidget = _.findWhere(gui.Gui.prototype.screen_classes, {name: 'bill'});
if (BillScreenWidget){
    BillScreenWidget.widget.include({
        render_receipt: function(){
            this._super();
            var order = this.pos.get_order();
            order.set_is_bill_printed(true);
            if (order && order.screen_data && order.screen_data.params && order.screen_data.params.print_invoice){
                order.screen_data.params = false;
                this.$('.receipt-total tr.emph td:first()').text('Amount Due:');
            }
            else {
                this.$('colgroup').remove();
                // var $elem_qty = this.$('.receipt-orderlines td.pos-right-align');
                // $elem_qty.addClass('pos-center-align');
                // $elem_qty.removeClass('pos-right-align');
                this.$('.v-customer-address').remove();
                this.$('.receipt-orderlines td:nth-child(3)').remove();
                this.$('.receipt-total').remove();
                this.$('.v-table-no').remove();
            }
        },
    });
}

var ButtonVoidOrder = screens.ActionButtonWidget.extend({
    'template': 'ButtonVoidOrder',
    button_click: function(){
        var self = this;
        var order = this.pos.get_order();
        var line = order.get_selected_orderline();
        if (line) {
            if(order.get_is_bill_printed()){
                this.gui.show_popup('textarea',{
                    title: _t('Add Void Note'),
                    value:   line.get_note(),
                    confirm: function(note) {
                        line.set_note(note);
                        var user = self.pos.get_cashier();
                        self.gui.select_user({
                            'security':     true,
                            'current_user': false,
                            'title':      _t('Need Manager Password'),
                            'only_managers': true,
                        }).then(function(user){
                            line.set_void(true);
                        });
                    },
                });
            }
            else {
                this.gui.show_popup(
                    "error", {'title': _("Please print the bill first.")});
            }
        }
    },
});


var VoidConfirmPopupWidget = PopupWidget.extend({
    template: 'VoidConfirmPopupWidget',
    renderElement: function(){
        var self = this;
        this.$('.void-confirm').click(function(event) {
            /* Act on the event */
            var order = self.pos.get_order();
            order.set_void(true);
            self.pos.push_order(self).then(function() {
                self.destroy({'reason':'abandon'});
            });
        });

    },
});
gui.define_popup({name:'void-confirm', widget: VoidConfirmPopupWidget});


chrome.OrderSelectorWidget.include({
    deleteorder_click_handler: function(event, $el) {
        var self  = this;
        var order = this.pos.get_order(); 
        if (!order) {
            return;
        } else if ( !order.is_empty() ){
            this.gui.show_popup('void-confirm',{
                'title': _t('Destroy Current Order ?'),
                'body': _t('You can make either Void Order or you will lose any data associated with the current order'),
            });
        } else {
            this.pos.delete_current_order();
        }
    },
    renderElement: function(){
        var self = this;
        this._super();
        this.$el.find('.select-order-option').change(function(event){
            var elem = $(this).find('option:selected');
            self.order_click_handler(event,$(elem));
        });
    },
});

var _super_order = models.Order.prototype;
models.Order = models.Order.extend({
    initialize: function(attr,options){
        this.is_void=false;
        this.driver_partner_id = false;
        this.is_bill_printed = false;
        _super_order.initialize.apply(this,arguments);
    },
    get_driver: function() {
        var self = this;
        return _.findWhere(this.pos.partners, {'id': this.driver_partner_id});
    },
    get_is_bill_printed: function(){
        return this.is_bill_printed;
    },
    set_is_bill_printed: function(_is){
        this.is_bill_printed = _is;
    },
    set_driver: function(pid) {
        this.driver_partner_id = pid;
    },
    get_order_type: function() {
        if (!this.order_type) {
            var default_order_type = this.table && this.table.floor && this.table.floor.default_order_type;
            this.set_order_type(default_order_type);
        }
        return this.order_type;
    },
    set_order_type: function(_otype) {
        this.order_type = _otype;
    },
    set_void: function(flag) {
        this.is_void = flag;
        var orderlines = order.get_orderlines();
        _.each(orderlines, function(line){
            line.set_void(flag);
        });
        this.trigger('change', this);
    },
    get_void: function() {
        return this.is_void;
    },
    export_as_JSON: function() {
        var data = _super_order.export_as_JSON.apply(this, arguments);
        data.is_void = this.is_void;
        data.order_type = this.order_type;
        data.driver_partner_id = this.driver_partner_id;
        return data;
    },
    init_from_JSON: function(json) {
        this.is_void = json.is_void;
        this.order_type = json.order_type;
        this.driver_partner_id = json.driver_partner_id;
        _super_order.init_from_JSON.call(this, json);
    },
    export_for_printing: function(){
        var receipt = _super_order.export_for_printing.call(this);
        var self = this,
            driver_name = this.driver_partner_id in this.pos.db.partner_by_id && this.pos.db.partner_by_id[this.driver_partner_id].name;
        console.log('___ driver_name : ', driver_name);
        return _.extend(receipt, {
            'is_void': this.is_void,
            'order_type': this.order_type,
            'driver_partner_id': this.driver_partner_id,
            'driver_name': driver_name,
            'client_address': this.attributes.client && this.attributes.client.address,
        });
    },
});

var _super_orderline = models.Orderline.prototype;
models.Orderline = models.Orderline.extend({
    initialize: function(attr,options){
        this.is_void=false;
        this.line_unit_price = 0;
        _super_orderline.initialize.apply(this,arguments);
    },
    set_void: function(flag) {
        if(this.get_void() != flag){
            this.line_unit_price = this.get_unit_price();
        }
        this.is_void = flag;
        this.set_unit_price(0);
        this.trigger('change', this);
        var $el = $(this.pos.gui.screen_instances.products.order_widget.el);
        var $line = $el.find('.selected');
        if($line.length) {
            $line.addClass('void-line');
        }
    },
    get_void: function() {
        return this.is_void;
    },
    export_as_JSON: function() {
        var data = _super_orderline.export_as_JSON.apply(this, arguments);
        data.is_void = this.is_void;
        data.line_unit_price = this.line_unit_price;
        return data;
    },
    init_from_JSON: function(json) {
        this.is_void = json.is_void;
        this.line_unit_price = json.line_unit_price;
        _super_orderline.init_from_JSON.call(this, json);
    },
});

screens.define_action_button({
    'name': 'btn_void_order',
    'widget': ButtonVoidOrder,
});


// Cooking State
var OrderTypeSelection = screens.ActionButtonWidget.extend({
    template: 'OrderTypeSelection',
    button_click: function(){
        var order = this.pos.get_order();
        order.set_order_type(this.el.value);
    },
});

screens.define_action_button({
    'name': 'action_order_type',
    'widget': OrderTypeSelection,
});

screens.OrderWidget.include({
    renderElement: function(){
        var self = this;
        this._super();
        var order = this.pos.get_order();
        if(order && typeof order.get_order_type == "function"){
            var order_type = order.get_order_type();
            $('.js_order_type').val(order_type);
        }
    },
});

var _super_numpad = screens.NumpadWidget.prototype;
screens.NumpadWidget.include({
    changedMode: function() {
        var self = this;
        var mode = this.state.get('mode');
        if (mode == 'discount' || mode == 'price'){
            var order = this.pos.get_order();
            var line = order.get_selected_orderline();
            if (line != undefined){
                this.gui.select_user({
                    'security':     true,
                    'current_user': false,
                    'title':      _t('Need Manager Password'),
                    'only_managers': true,
                }).then(function(user){
                    $('.selected-mode').removeClass('selected-mode');
                    $(_.str.sprintf('.mode-button[data-mode="%s"]', mode), self.$el).addClass('selected-mode');
                });
            }
        }
        else {
            this._super.apply(this, arguments);
        }
    },
});

var PopupSelectDriver = PopupWidget.extend({
    template: 'ShowPopupDriverList',
    events: _.extend({}, PopupWidget.prototype.events, {
        'click .cancel':  'click_cancel',
    }),
    click_confirm: function(){
        var options = this.options || {};
        var self = this;
        var partner_id = parseInt(this.$el.find('select').val());
        var order = this.pos.get_order();
        order.set_driver(partner_id);
        var cur_screen = self.gui.current_screen;
        var driver = order.get_driver();
        cur_screen.$el.find('.js_driver_name').text(driver.name);
        this._super.apply(this, arguments);
    },
});
gui.define_popup({name:'show_popup_select_driver', widget: PopupSelectDriver});


screens.PaymentScreenWidget.include({
    renderElement: function() {
        var self = this;
        this._super();
        this.$('.js_set_driver').click(function(){
            self.click_set_driver();
        });
        this.$('.js_print_invoice').click(function(event) {
            self.gui.show_screen('bill', {'print_invoice': true});
        });
    },

    click_set_driver: function(){
        var drivers = this.pos.partners.filter(function(partner) {
            return partner.is_driver;
        });
        this.gui.show_popup('show_popup_select_driver', {
            title: _('Select Driver'),
            records: drivers,
        });
    },

    show: function(){
        this._super();
        var order = this.pos.get_order();
        if(order.order_type == 'delivery'){
            $('.js_set_driver').show();
        }
        else {
            $('.js_set_driver').hide();
        }
    },

});

});
