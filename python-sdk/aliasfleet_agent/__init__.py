"""
AliasFleet Agent Toolkit - Official Python SDK for AI Agent Inboxes
"""

from .client import AliasFleetAgentClient
from .otp import extract_otp_code, extract_verification_link

__version__ = "1.0.0"
__all__ = ["AliasFleetAgentClient", "extract_otp_code", "extract_verification_link"]
