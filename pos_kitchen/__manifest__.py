# -*- coding: utf-8 -*-

{
    'name': 'POS Kitchen',
    'version': '1.0',
    'category': 'POS',
    'summary': 'POS Kitchen Screens',
    'sequence': 1,
    'description': """
POS Kitchen
====================================
    """,
    'author': 'Sismatix Co.',
    'website': 'http://sismatix.com/',
    'depends': ['bus', 'pos_restaurant', 'web_widget_colorpicker'],
    'data': [
        'security/ir.model.access.csv',
        'views/templates.xml',
        'views/pos_views.xml',
        'views/pos_order_synch.xml',
    ],
    'qweb': [
        'static/src/xml/pos_redesign.xml',
    ],
}
