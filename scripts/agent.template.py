#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.12"
# dependencies = ["requests"]
# ///
import os
import json
import requests
import sys
import platform
import importlib.util
import subprocess
import tempfile

if "SHEETBOT_BASEURL" not in os.environ:
    SHEETBOT_BASEURL = "${req.protocol}://${req.get('host')}"
    os.environ["SHEETBOT_BASEURL"] = SHEETBOT_BASEURL
else:
    SHEETBOT_BASEURL = os.environ["SHEETBOT_BASEURL"]


def check_for_errors(response):
    if response.status_code == 401:
        raise ValueError("Unauthenticated")
    elif response.status_code == 403:
        raise ValueError("Unauthorized")
    elif response.status_code == 500:
        raise ValueError("Internal server error")
    elif response.status_code != 200:
        raise ValueError("Some error occurred")
    return response


headers = {}
if os.environ.get("SHEETBOT_AUTH_USER") and os.environ.get("SHEETBOT_AUTH_PASS"):
    auth_response = requests.post(
        SHEETBOT_BASEURL + "/login",
        json={
            "username": os.environ["SHEETBOT_AUTH_USER"],
            "password": os.environ["SHEETBOT_AUTH_PASS"],
        },
    )
    del os.environ["SHEETBOT_AUTH_USER"]
    del os.environ["SHEETBOT_AUTH_PASS"]
    if auth_response.status_code == 200:
        auth_json = auth_response.json()
        headers["Authorization"] = f"Bearer {auth_json['token']}"
    else:
        raise ValueError("Login failed")

local_capabilities = {}
try:
    if os.path.exists("./.capabilities.json"):
        with open("./.capabilities.json") as f:
            local_capabilities.update(json.load(f))

    if os.path.exists("./.capabilities.dynamic.py"):
        spec = importlib.util.spec_from_file_location(
            "capabilities", "./.capabilities.dynamic.py"
        )
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            dynamic_capabilities = module.getCapabilities(local_capabilities)
            local_capabilities.update(dynamic_capabilities)

    if os.path.exists("./.capabilities.override.json"):
        with open("./.capabilities.override.json") as f:
            local_capabilities.update(json.load(f))

    print("capabilities:", local_capabilities)
except Exception as e:
    print("Ignoring capabilities error:")
    print(e)

capabilities = {"os": sys.platform, "arch": platform.machine(), **local_capabilities}

response = check_for_errors(
    requests.post(
        SHEETBOT_BASEURL + "/tasks/get",
        headers={**headers, "Content-Type": "application/json"},
        json={"type": "python", "capabilities": capabilities},
    )
)

json_data = response.json()
# print(json_data)
if "script" in json_data:
    os.environ["SHEETBOT_TASK_ID"] = json_data["id"]
    os.environ["SHEETBOT_AUTHORIZATION_HEADER"] = headers.get("Authorization", "")
    os.environ["SHEETBOT_TASK_BASEURL"] = SHEETBOT_BASEURL + "/tasks/" + json_data["id"]
    os.environ["SHEETBOT_TASK_ACCEPTURL"] = (
        SHEETBOT_BASEURL + "/tasks/" + json_data["id"] + "/accept"
    )
    os.environ["SHEETBOT_TASK_COMPLETEURL"] = (
        SHEETBOT_BASEURL + "/tasks/" + json_data["id"] + "/complete"
    )
    os.environ["SHEETBOT_TASK_FAILEDURL"] = (
        SHEETBOT_BASEURL + "/tasks/" + json_data["id"] + "/failed"
    )
    os.environ["SHEETBOT_TASK_DATAURL"] = (
        SHEETBOT_BASEURL + "/tasks/" + json_data["id"] + "/data"
    )
    os.environ["SHEETBOT_TASK_ARTEFACTURL"] = (
        SHEETBOT_BASEURL + "/tasks/" + json_data["id"] + "/artefacts"
    )

    check_for_errors(
        requests.post(
            os.environ["SHEETBOT_TASK_ACCEPTURL"],
            headers={**headers, "Content-Type": "application/json"},
            json={},
        )
    )

    try:
        script_response = requests.get(json_data["script"])
        script_code = script_response.text
        if "/// script" in script_code:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
                f.write(script_code)
                temp_file = f.name
            result = subprocess.run(
                ["uv", "run", "--script", temp_file],
                capture_output=True,
                text=True,
                env=os.environ.copy(),
            )
            os.unlink(temp_file)
            if result.returncode != 0:
                raise Exception(result.stderr)
            data = {}
        else:
            exec_globals = {}
            exec(script_code, exec_globals)
            data = exec_globals.get("data", {})
        check_for_errors(
            requests.post(
                os.environ["SHEETBOT_TASK_COMPLETEURL"],
                headers={**headers, "Content-Type": "application/json"},
                json={"data": data},
            )
        )
    except Exception as e:
        print(e)
        check_for_errors(
            requests.post(
                os.environ["SHEETBOT_TASK_FAILEDURL"],
                headers={**headers, "Content-Type": "application/json"},
                json={},
            )
        )
