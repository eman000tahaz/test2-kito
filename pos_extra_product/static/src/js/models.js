odoo.define('pos_extra_product.models', function (require) {
"use strict";

var models = require('point_of_sale.models');
var ProductProduct = _.find(models.PosModel.prototype.models, function(p){ 
    return p.model == 'product.product';
});
ProductProduct.fields.push('extra_product_ids');

var _super_loaded = ProductProduct.loaded;
ProductProduct.loaded = function(self, products){
    var new_products = [];
    products.map(function(prod){
        prod.extra_products = [];
        prod.extra_product_ids.map(function(extra_pid){
            var item = _.findWhere(products, {id: extra_pid});
            prod.extra_products.push(item);
        });
    })
    _super_loaded(self, products);
};


});
