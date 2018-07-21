{
    'name': 'POS Payment Method Commession',
    'version': '10.0.1.0.0',
    'category': 'Point Of Sale',
    'license': 'AGPL-3',
    'summary': 'POS ',
    'description': """
    POS Payment Method (Bank) Commession
""",
    'author': 'Sismatix Co.',
    'website': 'http://sismatix.com/',
 
    'depends': ['point_of_sale'],
    'data': [
        'views/product_view.xml',
        ],

    'application': True,
    'installable': True,
}
