# -*- coding: utf-8 -*-
{
    "name": """POS Extra Products""",
    "summary": """Set predefined products for separate product line""",
    "category": "Point of Sale",
    "version": "1.0.1",
    "application": False,
    "sequence": 0,
    "description": """
    Link Extra Products with POS Product Line
    """,
    "author": "Tauras",
    "depends": [
        "pos_restaurant",
    ],
    "data": [
        "views/views.xml",
        "views/template.xml",
        "views/pos_views.xml",
    ],
    "qweb": [
        "static/src/xml/pos.xml",
        "static/src/xml/kitchen.xml",
    ],
    "installable": True,
}
