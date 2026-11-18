from fastapi import APIRouter
from pydantic import BaseModel
from typing import Literal, Optional
from services.ros_client import ROSClient
from services.profile import load_limits

router = APIRouter()
ros = ROSClient()
limits = load_limits()

# All fields are numeric and optional on the HTTP side
# the server will interpret missing values as 0.0
class MoveCommand(BaseModel):
    x: Optional[float] = 0.0
    y: Optional[float] = 0.0
    angular_z: Optional[float] = 0.0


class StatusResponse(BaseModel):
    connected: bool
    battery: Optional[float]
    voltage: Optional[float] = None
    mode: Optional[str] = None


class ModeCommand(BaseModel):
    mode: Literal['manual', 'local', 'cloud']


class ChatMessage(BaseModel):
    message: str


def _normalized(value):
    value = float(value or 0.0)
    return max(-1.0, min(1.0, value)) if value == value else 0.0  # NaN becomes 0


# The client sends -1..1 per axis; the robot profile says what full deflection means in m/s and rad/s
@router.post("/move")
def move_robot(cmd: MoveCommand):
    x = _normalized(cmd.x) * limits["max_linear_velocity"]
    y = _normalized(cmd.y) * limits["max_linear_velocity"]
    ang = _normalized(cmd.angular_z) * limits["max_angular_velocity"]
    ros.publish_cmd_vel(linear_x=x, linear_y=y, angular_z=ang)
    return {"status": "ok", "x": x, "y": y, "angular_z": ang}


# Receive the selected message and publish it to the speech node using the helper function
@router.post('/chat')
def chat_message(msg: ChatMessage):
    try:
        text = str(msg.message or '').strip()
        ros.publish_speech(text)
        return {"status": "ok", "message": text}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# Ask the brain node to switch speech mode. The status endpoint reports the mode the brain confirms
@router.post('/mode')
def set_mode(cmd: ModeCommand):
    try:
        ros.publish_mode(cmd.mode)
        return {"status": "ok", "mode": cmd.mode}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.post('/emergency_stop')
def emergency_stop():
    try:
        ros.publish_emergency_stop()
        return {"status": "ok", "message": "emergency stop sent"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# Return a small status object about ROS connection and battery (if available)
@router.get("/status", response_model=StatusResponse)
def robot_status():
    try:
        st = ros.get_status()
        return StatusResponse(connected=bool(st.get('connected', False)), battery=st.get('battery'),
                              voltage=st.get('voltage'), mode=st.get('mode'))
    except Exception:
        return StatusResponse(connected=False, battery=None, mode=None)