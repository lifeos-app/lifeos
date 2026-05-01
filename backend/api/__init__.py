"""
LifeOS Public API — Blueprint Registration

Registers the public_api blueprint with the Flask app,
enabling external integrations (Strava, Apple Health, Google Fit,
banking, calendar, etc.) to push data INTO LifeOS.

Usage in app.py:
    from api import register_api_blueprint
    register_api_blueprint(app)
"""

from .public_api import public_api_bp


def register_api_blueprint(app):
    """Register the Public API blueprint on the Flask app.

    Adds all /api/v1/* routes to the Flask application.
    """
    app.register_blueprint(public_api_bp, url_prefix='/api/v1')