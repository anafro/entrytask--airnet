import http.cookiejar
import json
import sys
import urllib.error
import urllib.request

base = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173').rstrip('/')
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def request(path, body=None):
    payload = None if body is None else json.dumps(body).encode()
    response = client.open(urllib.request.Request(base + '/api' + path, data=payload, headers={'Content-Type': 'application/json'}), timeout=15)
    return json.load(response)

try:
    health = request('/health')
    assert health['status'] == 'ok' and health['php'].startswith('7.4.'), health
    login = request('/demo/login', {'role': 'editor'})
    assert login['employee']['role'] == 'editor' and login['csrf'], login
    tickets = request('/tickets')['tickets']
    assert len(tickets) >= 5, tickets
    assert len(request('/sources')['sources']) >= 3
    detail = request('/tickets/102')
    assert detail['ticket']['id'] == 102 and detail['ticket']['source']['id'] == 2
    print('PASS: PHP 7.4, isolated database, session, list, sources, normal ticket')
except (AssertionError, OSError, ValueError) as error:
    print('FAIL:', str(error), file=sys.stderr)
    sys.exit(1)
