# -*- coding: utf-8 -*-

from odoo import api, fields, models


class ResFloor(models.Model):
    _inherit = "restaurant.floor"

    default_order_type = fields.Selection(
        [('dining', 'Dining'), ('takeaway', 'Take Away'), ('delivery', 'Delivery')],
        string='Default Order Type', default='dining')


class POSOrder(models.Model):
    _inherit = "pos.order"

    is_void = fields.Boolean("Void Order ?")
    driver_partner_id = fields.Many2one('res.partner', string="Driver", domain=[('is_driver', '=', True)])
    order_type = fields.Selection(
        [('dining', 'Dining'), ('takeaway', 'Take Away'), ('delivery', 'Delivery')],
        string='Order Type', default='dining')

    @api.model
    def _order_fields(self, ui_order):
        res = super(POSOrder, self)._order_fields(ui_order)
        res.update({
            'is_void': ui_order.get('is_void', False),
            'order_type': ui_order.get('order_type'),
            'driver_partner_id': ui_order.get('driver_partner_id', False),
        })
        return res


class POSOrderLine(models.Model):
    _inherit = "pos.order.line"

    is_void = fields.Boolean("Void Order Line ?")

    @api.model
    def create(self, vals):
        if vals.get('parent_line_id'):
            line = self.browse(vals['parent_line_id'])
            if line.is_void:
                vals['price_unit'] = 0
                vals['is_void'] = True
        return super(POSOrderLine, self).create(vals)

    def _order_line_fields(self, line):
        line = super(POSOrderLine, self)._order_line_fields(line)
        if line and len(line) >= 2:
            if line[2].get('is_void'):
                line[2].update({
                    'price_unit': 0.0
                })
        return line
