"""
Automated unit test suite for AliasFleet Python Agent SDK and OTP parser.
"""

import sys
import os

# Add python-sdk to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "python-sdk"))

from aliasfleet_agent import AliasFleetAgentClient, extract_otp_code, extract_verification_link

def run_tests():
    print("--- Running AliasFleet Python Agent SDK Test Suite ---")

    # 1. Test OTP extraction from various email texts
    samples = [
        ("Your verification code is 492019.", "492019"),
        ("Please enter OTP: 1234 to proceed", "1234"),
        ("Use security code 928-194 for sign-in", "928194"),
        ("Welcome! Your 8-digit token is: 84729103.", "84729103")
    ]
    for text, expected in samples:
        extracted = extract_otp_code(text)
        assert extracted == expected, f"Failed: expected {expected}, got {extracted} for '{text}'"
    print(f"[PASS] OTP parser correctly extracted codes from {len(samples)} diverse samples.")

    # 2. Test Verification link extraction
    html_sample = '<p>Click <a href="https://example.com/auth/verify?token=abc123xyz">here to verify</a> your email.</p>'
    link = extract_verification_link(html_sample)
    assert "verify" in link, f"Failed to extract verification link: {link}"
    print(f"[PASS] Verification link extractor found URL: {link}")

    # 3. Test HMAC Webhook verification
    client = AliasFleetAgentClient(simulation=True)
    body = '{"event":"email.received","from":"sender@test.com","to":"agent@aliasfleet.com"}'
    secret = "af_whsec_test_secret_12345"
    timestamp = "1787652000"

    import hmac, hashlib
    expected_hash = hmac.new(secret.encode(), f"{timestamp}.{body}".encode(), hashlib.sha256).hexdigest()
    sig_header = f"t={timestamp},v1={expected_hash}"

    valid = client.verify_webhook_signature(body, sig_header, secret)
    assert valid is True, "HMAC signature verification failed on valid payload!"

    invalid = client.verify_webhook_signature(body, f"t={timestamp},v1=tampered_signature", secret)
    assert invalid is False, "HMAC signature passed on tampered signature!"
    print("[PASS] HMAC-SHA256 signature verification contract passed (positive and negative cases).")

    # 4. Test Inbox Provisioning (Simulation Mode)
    inbox = client.create_inbox(label="Browser Agent E2E Test", local_part="agent-browser-42")
    assert inbox["email"] == "agent-browser-42@aliasfleet.com", f"Unexpected email: {inbox['email']}"
    assert inbox["active"] is True
    print(f"[PASS] Agent inbox provisioned successfully: {inbox['email']} (ID: {inbox['id']})")

    # 5. Test List Inboxes
    inboxes = client.list_inboxes()
    assert len(inboxes) >= 1
    print(f"[PASS] List inboxes returned {len(inboxes)} active addresses.")

    print("--- ALL PYTHON SDK TESTS PASSED ---")

if __name__ == "__main__":
    run_tests()
