odoo.define('pos_kitchen.custom', function (require) {
"use strict";

// var PosBaseWidget = require('point_of_sale.BaseWidget');
// var chrome = require('point_of_sale.chrome');
// var gui = require('point_of_sale.gui');
var models = require('point_of_sale.models');
var screens = require('point_of_sale.screens');
var Gui = require('point_of_sale.gui');
var core = require('web.core');
var Model = require('web.DataModel');

var QWeb = core.qweb;
var _t = core._t;


// POS Category -> Color

var PosCategory = _.find(models.PosModel.prototype.models, function(p){
    if (p.model == 'pos.category'){
        return true;
    }
    return false;
});
PosCategory.fields.push('color');
var _super_loaded = PosCategory.loaded;
PosCategory.loaded = function(self, categories){
    var new_categ = [];
    if(!self.config.categ_ids.length) {
        new_categ = categories;
    }
    _.each(self.config.categ_ids, function (item) {
        var elem = _.where(categories, {'id': item});
        if(elem.length){
            new_categ = new_categ.concat(elem);
        }
    });
    self.db.add_categories(new_categ);
};

var ProductProduct = _.find(models.PosModel.prototype.models, function(p){ 
    if (p.model == 'product.product'){
        return true;
    }
    return false;
});
var _super_loaded = ProductProduct.loaded;
ProductProduct.loaded = function(self, products){
    var new_products = [];
    var categories = self.db.category_by_id;
    _.each(products, function (prod) {
        prod.bgcolor = 'white';
        if(prod.pos_categ_id.length){
            var categ = categories[prod.pos_categ_id[0]];
            if (categ) {
                prod.bgcolor = categ.color
            }
        }
    });
    _super_loaded(self, products);
};


Gui.Gui.include({
    play_sound: function(sound) {
        var src = '';
        if (sound === 'error') {
            src = "/point_of_sale/static/src/sounds/error.wav";
        } else if (sound === 'bell') {
            src = "/point_of_sale/static/src/sounds/bell.wav";
        } else if (sound === 'tin') {
            src = "/pos_kitchen/static/src/sounds/tin.mp3";
        } else {
            console.error('Unknown sound: ',sound);
            return;
        }
        $('body').append('<audio src="'+src+'" autoplay="true"></audio>');
    },
});

});
