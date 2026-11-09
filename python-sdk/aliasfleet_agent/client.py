"""
AliasFleet Python Agent SDK
Lightweight, dependency-free client designed for AI agents, Playwright, and Browser-Use automation.
"""

import os
import hmac
import hashlib
import json
import urllib.request
import urllib.error
from typing import Optional, Dict, Any, List

from .otp import extract_otp_code, extract_verification_link

class AliasFleetAgentClient:
    """
    Client for managing dedicated forwarding addresses and webhooks for AI agents.
    Supports both live API mode and local simulation mode (zero credentials required).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        simulation: bool = False
    ):
        self.api_key = api_key or os.getenv("ALIASFLEET_API_KEY", "")
        self.base_url = (base_url or os.getenv("ALIASFLEET_API_BASE_URL", "https://api.aliasfleet.com")).rstrip("/")
        self.simulation = simulation or os.getenv("ALIASFLEET_MOCK", "").lower() in ("true", "1") or not self.api_key
        self._mock_inboxes = []

    def _request(self, endpoint: str, method: str = "GET", payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if self.simulation:
            return self._mock_request(endpoint, method, payload)

        url = f"{self.base_url}{endpoint}"
        data = json.dumps(payload).encode("utf-8") if payload else None
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": "AliasFleet-Python-Agent-SDK/1.0"
        }

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            err_body = err.read().decode("utf-8")
            try:
                parsed = json.loads(err_body)
                msg = parsed.get("error") or parsed.get("detail") or err_body
            except Exception:
                msg = err_body
            raise RuntimeError(f"AliasFleet API error ({err.code}): {msg}")

    def _mock_request(self, endpoint: str, method: str, payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if endpoint == "/v1/me":
            return {
                "user_id": "00000000-0000-0000-0000-000000000001",
                "email": "agent@local.test",
                "tier": "business",
                "simulation": True,
                "scopes": ["aliases:read", "aliases:write", "webhooks:read", "webhooks:write"]
            }

        if endpoint == "/v1/aliases" and method == "POST":
            local = (payload or {}).get("local_part") or f"agent-{os.urandom(4).hex()}"
            item = {
                "id": f"sim-{os.urandom(6).hex()}",
                "local_part": local,
                "domain": "aliasfleet.com",
                "full_address": f"{local}@aliasfleet.com",
                "description": (payload or {}).get("description", "Agent dedicated address"),
                "active": True
            }
            self._mock_inboxes.append(item)
            return {"success": True, "alias": item, "simulation": True}

        if endpoint.startswith("/v1/aliases") and method == "GET":
            return {"success": True, "aliases": self._mock_inboxes, "simulation": True}

        return {"success": True, "simulation": True}

    def create_inbox(
        self,
        label: str = "Agent Inbox",
        local_part: Optional[str] = None,
        domain_id: Optional[str] = None,
        forward_to_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Provision a dedicated forwarding address and programmable inbox for an agent.
        """
        payload = {
            "description": label,
            "local_part": local_part,
            "domain_id": domain_id,
            "forward_to_email": forward_to_email
        }
        res = self._request("/v1/aliases", method="POST", payload=payload)
        alias = res.get("alias", res)
        return {
            "id": alias.get("id"),
            "email": alias.get("full_address"),
            "local_part": alias.get("local_part"),
            "domain": alias.get("domain"),
            "active": alias.get("active", True),
            "simulation": res.get("simulation", False)
        }

    def list_inboxes(self) -> List[Dict[str, Any]]:
        """
        List all active inboxes managed under this account.
        """
        res = self._request("/v1/aliases", method="GET")
        return res.get("aliases", [])

    def get_account_info(self) -> Dict[str, Any]:
        """
        Query API key permissions and tier status.
        """
        return self._request("/v1/me", method="GET")

    @staticmethod
    def verify_webhook_signature(
        raw_body: str,
        signature_header: str,
        secret: str
    ) -> bool:
        """
        Verify the cryptographic HMAC-SHA256 signature from X-AliasFleet-Signature.
        Header format: t=timestamp,v1=signature_hash
        """
        if not signature_header or not secret:
            return False

        try:
            parts = dict(item.split("=", 1) for item in signature_header.split(","))
            timestamp = parts.get("t")
            received_sig = parts.get("v1")
            if not timestamp or not received_sig:
                return False

            signed_payload = f"{timestamp}.{raw_body}".encode("utf-8")
            expected_sig = hmac.new(
                secret.encode("utf-8"),
                signed_payload,
                hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(expected_sig, received_sig)
        except Exception:
            return False

    @staticmethod
    def parse_otp(text: str) -> Optional[str]:
        return extract_otp_code(text)

    @staticmethod
    def parse_link(text_or_html: str) -> Optional[str]:
        return extract_verification_link(text_or_html)
