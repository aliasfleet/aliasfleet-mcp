"""
OTP and verification link extraction utilities for AI browser automation agents.
"""

import re
from typing import Optional, List

def extract_otp_code(text: str) -> Optional[str]:
    """
    Extract 4, 6, or 8-digit verification code from email body or subject line.
    Handles formats like:
      - "Your code is 123456"
      - "Verification code: 849201"
      - "Security PIN: 4819"
      - "Use 938-102 to verify"
    """
    if not text:
        return None

    # Common patterns prioritizing labeled codes
    patterns = [
        r'(?:code|pin|otp|passcode|token|verification|verify)[\s\:\-\#\=]+([0-9]{4,8})\b',
        r'\b([0-9]{3}[\s\-][0-9]{3})\b',
        r'\b([0-9]{6})\b',
        r'\b([0-9]{4})\b',
        r'\b([0-9]{8})\b'
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            code = match.group(1).replace('-', '').replace(' ', '')
            return code

    return None

def extract_verification_link(text_or_html: str) -> Optional[str]:
    """
    Extract verification or magic link from email text or HTML content.
    Prioritizes URLs containing 'verify', 'confirm', 'activate', or 'token'.
    """
    if not text_or_html:
        return None

    url_pattern = r'https?://[^\s<>"\']+'
    urls = re.findall(url_pattern, text_or_html)

    for url in urls:
        lower_url = url.lower()
        if any(keyword in lower_url for keyword in ['verify', 'confirm', 'activate', 'token', 'magic', 'signup']):
            return url

    return urls[0] if urls else None
