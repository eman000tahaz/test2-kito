odoo.define('pos_driver.pos_driver', function (require) {
"use strict";


var screens = require('point_of_sale.screens');

var DeliveryButton = screens.ActionButtonWidget.extend({
    template: 'DeliveryButton',
    button_click: function(){
        var self = this;
        this.gui.show_popup('number',{
            'title': 'Delivery Amount',
            'value': this.pos.config.delivery_amount,
            'confirm': function(val) {
                val = Math.round(Math.max(0,Math.min(100,val)));
                self.apply_delivery(val);
            },
        });
    },
    apply_delivery: function(pc) {
        var order    = this.pos.get_order();
        var lines    = order.get_orderlines();
        var product  = this.pos.db.get_product_by_id(this.pos.config.delivery_product_id[0]);

        // Remove existing deliverys
        var i = 0;
        while ( i < lines.length ) {
            if (lines[i].get_product() === product) {
                order.remove_orderline(lines[i]);
            } else {
                i++;
            }
        }

        // Add delivery
        var delivery =  pc;

        if( delivery > 0 ){
            order.add_product(product, { price: delivery });
        }
    },
});

screens.define_action_button({
    'name': 'delivery',
    'widget': DeliveryButton,
    'condition': function(){
        return this.pos.config.iface_deliver && this.pos.config.delivery_product_id;
    },
});

});
