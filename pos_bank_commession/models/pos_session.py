from odoo import api, fields, models, SUPERUSER_ID, _
from datetime import datetime
from odoo.exceptions import UserError


class PaymentMethod(models.Model):
    _inherit = "account.journal"

    commession_account = fields.Many2one("account.account", "Expenses Account")
    commession_account2 = fields.Many2one("account.account", "Commesssion Account")
    commession_value = fields.Float("Commession Value")
    is_commession = fields.Boolean("Commession")


class POSSession(models.Model):
    _inherit = "pos.session"

    commession_check = fields.Boolean(string='Commession')
    @api.multi
    def action_pos_session_create_commession_move(self):

        created_move_ids = []
        move_line_obj = self.env['account.move.line']
        journal_ids = self.env['account.journal'].search([('type', '=', 'general')])
        for session in self:
            if session.state != "closed":
                raise UserError(_('You Have To Close Session Before Create Bank Commessions'))
            local_context = dict(self._context, force_company=session.config_id.company_id.id)
            # if session.commession_move:
            #     continue
            company_currency = session.config_id.company_id.currency_id.id
            current_currency = session.config_id.company_id.currency_id.id
            # we select the context to use accordingly if it's a multicurrency case or not
            # But for the operations made by _convert_amount, we always need to give the date in the context
            ctx = local_context.copy()
            ctx['date'] = datetime.now()
            ctx['check_move_validity'] = False
            # Create the account move record.


            for st in session.statement_ids:
                if st.journal_id.is_commession:
                    # move_id = self.env['account.move'].create(session.account_move_get(st.name))
                    for stline in st.line_ids:
                        move_ids = self.env['account.move'].search([("statement_line_id","=",stline.id)])
                        move_id = move_ids[0]
                        move_id.button_cancel()
                        move_line_id = self.env['account.move.line'].search([("statement_id","=",st.id),
                                                                              ("account_id","=",st.journal_id.default_debit_account_id.id),
                                                                              ("move_id","=",move_id.id)],limit=1)
                        if st.journal_id.commession_value <=50:
                            move_line_id.with_context(ctx).write(session.update_move_line(move_line_id.debit-stline.amount * st.journal_id.commession_value / 100,0))

                            move_line = self.env['account.move.line'].with_context(ctx). \
                                create(session.first_move_line_get('Bank Commession',
                                                                   st.journal_id.commession_account.id,
                                                                   journal_ids and journal_ids.ids[0],
                                                                   datetime.now(), move_id.id, company_currency,
                                                                   current_currency,
                                                                   stline.amount * st.journal_id.commession_value / 100, 0.0,
                                                                   stline.amount * st.journal_id.commession_value / 100,st.id))


                            session.write({'commession_check': True})
                            created_move_ids.append(move_id.id)
                            move_id.post()
                        else:


                            move_line = self.env['account.move.line'].with_context(ctx). \
                                create(session.first_move_line_get('Bank Commession',
                                                                   st.journal_id.commession_account.id,
                                                                   journal_ids and journal_ids.ids[0],
                                                                   datetime.now(), move_id.id, company_currency,
                                                                   current_currency,
                                                                   stline.amount , 0.0,
                                                                   stline.amount ,st.id))

                            move_line = self.env['account.move.line'].with_context(ctx). \
                                create(session.first_move_line_get('Bank Commession',
                                                                   st.journal_id.commession_account2.id,
                                                                   journal_ids and journal_ids.ids[0],
                                                                   datetime.now(), move_id.id, company_currency,
                                                                   current_currency,
                                                                   move_line_id.debit-stline.amount * st.journal_id.commession_value / 100, 0.0,
                                                                   stline.amount ,st.id))
                            move_line_id.with_context(ctx).write(session.update_move_line(0,move_line_id.debit-stline.amount * st.journal_id.commession_value / 100))


                            session.write({'commession_check': True})
                            created_move_ids.append(move_id.id)
                            move_id.post()


        return created_move_ids

    @api.multi
    def account_move_get(self,name):
        journal_ids = self.env['account.journal'].search([('type', '=', 'general')])
        depreciation_date = datetime.now()


        move = {
            'name': name + '- Bank Charges',
            'date': depreciation_date,
            'journal_id': journal_ids and journal_ids.ids[0],
            # 'asset_id':line.purchase_property_id.id or False,
            'source': name or False,
        }
        return move

    @api.multi
    def first_move_line_get(self, name, account_id, journal_id, date, move_id, company_currency, current_currency,
                            debit, credit, amount, statement_id):

        if debit < 0.0: debit = 0.0
        if credit < 0.0: credit = 0.0
        sign = debit - credit < 0 and -1 or 1
        # set the first line of the voucher
        move_line = {
            'name': name,
            'debit': debit,
            'credit': credit,
            'account_id': account_id,
            'move_id': move_id,
            'journal_id': journal_id,
            'statement_id': statement_id,
            'currency_id': company_currency != current_currency and current_currency or False,
            'amount_currency': (sign * abs(amount)  # amount < 0 for refunds
                                if company_currency != current_currency else 0.0),
            'date': date,
            'date_maturity': date
        }
        return move_line

    @api.multi
    def update_move_line(self, debit,credit):

        # set the first line of the voucher
        move_line = {
            'debit': debit,
            'credit':credit,
        }
        return move_line
