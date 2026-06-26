import urllib3

import requests

from backend.config import config


def external_get(url: str, **kwargs):
    verify = config.external_api_verify_tls
    if not verify:
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    kwargs.setdefault("verify", verify)
    return requests.get(url, **kwargs)
