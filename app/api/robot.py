from fastapi import APIRouter
from pydantic import BaseModel
from typing import Literal, Optional
from services.ros_client import ROSClient

router = APIRouter()
ros = ROSClient()

# All fields are numeric and optional on the HTTP side
# the server will interpret missing values as 0.0
class MoveCommand(BaseModel):
    x: Optional[float] = 0.0
    y: Optional[float] = 0.0
    angular_z: Optional[float] = 0.0


class StatusResponse(BaseModel):
    connected: bool
    battery: Optional[float]
    mode: Optional[str] = None


class ModeCommand(BaseModel):
    mode: Literal['manual', 'local', 'cloud']


class ChatMessage(BaseModel):
    message: str


# Publish the exact numeric values received from the client to /cmd_vel using the helper function
# The client is responsible for normalization/scaling
# TODO double-check the values and filter out wrong values
@router.post("/move")
def move_robot(cmd: MoveCommand):
    x = float(cmd.x or 0.0)
    y = float(cmd.y or 0.0)
    ang = float(cmd.angular_z or 0.0)
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
                              mode=st.get('mode'))
    except Exception:
        return StatusResponse(connected=False, battery=None, mode=None)