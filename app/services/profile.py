import os

import yaml

# Robot profile (semubot_bringup config/profiles), mounted into the container at the path in SEMUBOT_PROFILE_FILE.
# Without a profile the limits are 1.0: the joystick values go to /cmd_vel as they are.
PROFILE_FILE = os.getenv("SEMUBOT_PROFILE_FILE", "")
SECTION = "semubot_webapp"
DEFAULTS = {"max_linear_velocity": 1.0, "max_angular_velocity": 1.0}


def load_limits(path=PROFILE_FILE):
    limits = dict(DEFAULTS)
    try:
        with open(path, encoding="utf-8") as profile_file:
            data = yaml.safe_load(profile_file) or {}
    except OSError:
        print(f"WARNING: no robot profile at '{path}', using limits {limits}")
        return limits
    section = (data.get(SECTION) or {}).get("ros__parameters") or {}
    for key in limits:
        if key in section:
            limits[key] = float(section[key])
    print(f"Robot profile {path}: {limits}")
    return limits
