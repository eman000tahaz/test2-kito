# -*- coding: utf-8 -*-

from odoo import api, fields, models
import json
import logging

_logger = logging.getLogger(__name__)

CHANNEL_NM_SYNCH = "pos.order.synch"
CHANNEL_NM_SYNCH_STATUS = "pos.order.synch.status"


class PosOrderSynch(models.Model):
    _name = 'pos.order.synch'
    _description = 'Order Synch'
    _display_name = 'order_uid'

    order_uid = fields.Char(string="Order", index=True)
    order_data = fields.Text('Order JSON format')
    write_date = fields.Datetime('Last Updated', default=fields.Datetime.now)
    pos_id = fields.Many2one('pos.session', string='POS')

    @api.model
    def update_orders(self, action, data_dict):
        json_data = json.loads(data_dict)
        SKIP_FIELDS = ['state']

        for row in json_data:
            uid = row.get('uid')
            order_count = self.search_count([('order_uid', 'ilike', uid)])
            if order_count:
                action = "update"
            if not action:
                return False
            elif action == "add":
                if not row.get('lines', []):
                    continue
                order = self.create({
                    'order_data': json.dumps(row),
                    'order_uid': uid,
                })
            elif action == "update":
                orders = self.search([('order_uid', 'ilike', uid)])
                for order in orders:
                    existing_lines = json.loads(order.order_data).get("lines", [])
                    index = -1
                    for pline in row.get('lines', []):
                        index += 1
                        line = pline[2]
                        eline = {}
                        if index < len(existing_lines):
                            eline = existing_lines[index][2]
                        for k, v in line.iteritems():
                            if k in SKIP_FIELDS:
                                line[k] = eline.get(k, line[k])
                    order.write({
                        'order_data': json.dumps(row),
                        'write_date': fields.Datetime.now()
                    })

    @api.model
    def synch_all(self):
        result = []
        for order in self.search([], order="create_date desc"):
            result.append({
                'data': order.order_data,
                'id': order.order_uid,
            })
        return result

    @api.model
    def remove_order(self, order_ids):
        unique_list = list(set(filter(lambda a: a, order_ids)))
        self.search([('order_uid', 'in', unique_list)]).unlink()

    @api.model
    def orderline_state(self, uid, line_id, state):
        orders = self.search([('order_uid', 'ilike', uid)])
        for order in orders:
            data = json.loads(order.order_data)
            for pline in data.get('lines', []):
                line = pline[2]
                if line['id'] == line_id:
                    line['state'] = state

            order.write({'order_data': json.dumps(data), 'write_date': fields.Datetime.now()})
        return True
