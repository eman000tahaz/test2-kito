# -*- coding: utf-8 -*-

{
    'name': 'POS Custom',
    'version': '1.0',
    'category': 'POS',
    'summary': 'POS Custom Screens',
    'sequence': 1,
    'description': """
POS Custom
====================================
- POS Delivery Type (Dining, Takeaway, Delivery)
    """,
    'author': 'Sismatix Co.',
    'website': 'http://sismatix.com/',
    'depends': [
        "pos_restaurant", "pos_extra_product", "pos_customer_form",
        "dashboard", "account", "purchase",
    ],
    'data': [
        'data/dashboard.xml',
        'views/templates.xml',
        'views/pos_views.xml',
        'views/partner_views.xml',
    ],
    'qweb': [
        'static/src/xml/pos.xml',
    ],
}
