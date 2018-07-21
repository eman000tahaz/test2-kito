# -*- coding: utf-8 -*-

import ast

from odoo import api, fields, models


class Product(models.Model):
    _inherit = "product.product"

    extra_product_ids = fields.Many2many(
        'product.product', 'product_extra_product_rel', 'product_id', 'extra_product_id', string='Extra Items')


class Order(models.Model):
    _inherit = "pos.order"

    @api.model
    def create(self, vals):
        record = super(Order, self).create(vals)
        Product = self.env['product.product']

        for line in record.lines.filtered('extra_items'):
            for extra in ast.literal_eval(line.extra_items):
                pid = extra.get('id')
                product = Product.browse(pid)
                line.create({
                    'product_id': product.id,
                    'price_unit': product.list_price,
                    'line_unit_price': product.list_price,
                    'qty': 1.0,
                    'name': product.display_name,
                    'tax_ids': [(6, 0, product.taxes_id.ids)],
                    'parent_line_id': line.id,
                    'order_id': record.id,
                })
        return record


class OrderLine(models.Model):
    _inherit = "pos.order.line"

    extra_items = fields.Text("Extra Products")
    parent_line_id = fields.Many2one('pos.order.line', string="Parent Line")
    line_unit_price = fields.Float("Line Price")

    def _order_line_fields(self, line):
        if line and len(line) >= 2:
            if line[2].get('extra_items'):
                line[2].update({
                    'price_unit': line[2].get('line_unit_price')
                })
        return super(OrderLine, self)._order_line_fields(line)
