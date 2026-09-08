"""Baseline security-response headers, added after the performance/security
audit flagged their absence (v1.38)."""


def test_api_response_carries_baseline_security_headers(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["x-frame-options"] == "DENY"
    assert resp.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "geolocation=()" in resp.headers["permissions-policy"]
    assert "max-age=" in resp.headers["strict-transport-security"]
    assert resp.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"


def test_swagger_docs_are_exempt_from_the_csp_so_the_cdn_assets_still_load(client):
    resp = client.get("/docs")
    assert resp.status_code == 200
    assert "content-security-policy" not in resp.headers
    # the other headers still apply everywhere, docs included
    assert resp.headers["x-content-type-options"] == "nosniff"
