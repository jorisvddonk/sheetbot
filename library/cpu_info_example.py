# /// script
# requires-python = ">=3.12"
# dependencies = ["psutil", "requests"]
# ///

import os
import json
import requests
import datetime
import psutil
import sys

SHEETBOT_BASEURL = None
if len(sys.argv) > 1:
    SHEETBOT_BASEURL = sys.argv[1]
elif not os.environ.get("SHEETBOT_BASEURL"):
    raise ValueError("SHEETBOT_BASEURL not set")
else:
    SHEETBOT_BASEURL = os.environ["SHEETBOT_BASEURL"]

# <name>cpu-info-report</name>

# AddTaskComments: <addTaskComments>
# This script collects CPU information including count, usage percentage, and frequency details, then submits the data to a sheet.
# </addTaskComments>

# <capabilitiesSchema>
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {"os": {"type": "string"}, "arch": {"type": "string"}},
}
# </capabilitiesSchema>

# <data>
{"sheet": "cpu-info"}
# </data>


def getData():
    response = requests.get(
        os.environ["SHEETBOT_TASK_BASEURL"],
        headers={"Authorization": os.environ.get("SHEETBOT_AUTHORIZATION_HEADER", "")},
    )
    response.raise_for_status()
    return response.json()["data"]


def submitData(data):
    response = requests.post(
        os.environ["SHEETBOT_TASK_DATAURL"],
        json={"data": data},
        headers={
            "Authorization": os.environ.get("SHEETBOT_AUTHORIZATION_HEADER", ""),
            "Content-Type": "application/json",
        },
    )
    response.raise_for_status()


def addSheetData(sheet, data):
    response = requests.post(
        f"{SHEETBOT_BASEURL}/sheets/{sheet}/data",
        json=data,
        headers={
            "Authorization": os.environ.get("SHEETBOT_AUTHORIZATION_HEADER", ""),
            "Content-Type": "application/json",
        },
    )
    response.raise_for_status()


taskData = getData()
sheet = taskData.get("sheet", "cpu-info")

# Collect CPU info
cpu_count = psutil.cpu_count()
cpu_percent = psutil.cpu_percent(interval=1)
cpu_freq = psutil.cpu_freq()

result = {
    "cpu_count": cpu_count,
    "cpu_percent": cpu_percent,
    "cpu_freq_current": cpu_freq.current if cpu_freq else None,
    "cpu_freq_min": cpu_freq.min if cpu_freq else None,
    "cpu_freq_max": cpu_freq.max if cpu_freq else None,
    "timestamp": datetime.datetime.now().isoformat(),
}

# Submit data
submitData(result)

# Add to sheet
sheet_key = result["timestamp"]
addSheetData(sheet, {"key": sheet_key, **result})
