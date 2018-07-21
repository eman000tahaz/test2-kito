# -*- coding: utf-8 -*-

from odoo import api, fields, models


class Partner(models.Model):
    _inherit = "res.partner"

    is_driver = fields.Boolean('Is Driver')
