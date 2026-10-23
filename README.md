# SemuBot WebAPP
## Overview
SemuBot WebAPP is a touchscreen-first robot control interface built with FastAPI and a static frontend. The application exposes a REST API that forwards movement commands and chat messages to a ROS system via `roslibpy`, and serves a mobile-friendly joystick UI. 

The project is designed for use with a ROS bridge server (`rosbridge_server`) and includes a companion ROS2 speech node that listens for messages published to `/speech_input`.

This repository continues the webapp from Karl Johan Krasilnikov's 2026 thesis, [Krasilnikov-thesis-2026-Webapp](https://github.com/SemuBot/Krasilnikov-thesis-2026-Webapp). The thesis repository keeps the version submitted with the thesis; development continues here.
  
## Features
- Touch joystick and rotation controls for driving the robot

- Quick-chat message publishing to robot

- Status polling for ROS connection and battery level  

- Docker-ready deployment with configurable ROS bridge host/port  

## Architecture  

- `app/main.py` - FastAPI web server and static file host

- `app/api/robot.py` - HTTP API routes for robot movement, chat, and status

- `app/services/ros_client.py` - ROS bridge client using `roslibpy`

- `app/static/` - frontend assets, including HTML, CSS, JS, and chat messages

- `speech_node/speech_node.py` - ROS2 node subscribing to `/speech_input` and speaking received messages

## Quick Start
### Installing Docker to the server
Follow the official installation guide: https://docs.docker.com/engine/install/


### Installing rosbridge to SemuBot
Install rosbridge-suites, if not already installed:

```bash
sudo apt update
sudo apt install ros-<ros2-distro>-rosbridge-suite
```

Start the ROS bridge server:
```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```


### Run the application
Clone the repository:
```bash
git clone https://github.com/SemuBot/semubot_webapp.git
cd semubot_webapp
```

The application can run either on the robot’s onboard computer or on a separate server within the same network. In either case, the `ROSBRIDGE_HOST` must be configured in `.env` accordingly.
  
From the project root start the application:
```bash
docker compose up --build
```

Then open the web interface on a mobile device:
```bash
http://server_ip:8000
```

## Usage
- Load the web app in a touch-capable browser.
 
- Use the joystick to send linear movement commands. 

- Use the rotate left/right buttons to send angular velocity commands.

- Tap the chat button to send predefined chat messages to the speech node.  

- The header shows connection status and battery level.
  

## Notes

- The server forwards `/api/robot/move` payloads directly to ROS on `/cmd_vel`.

- The speech node must be built and launched within the robot’s ROS2 environment

- The frontend loads `api.js`, `joystick.js`, and `status.js` only on touch-capable devices.


## Used ROS Topics

- `/cmd_vel` (geometry_msgs/Twist) - receives movement commands from the client

- `/speech_input` (std_msgs/String) - client publishes chat messages to this topic for the speech node to speak

- `/battery_level` (std_msgs/Float32) - published by the robot to indicate battery level (expects values from 0.0 to 1.0 representing battery percentage)

- `/emergency_stop` (std_msgs/Bool) - published by the client to indicate emergency stop status (true for active)


## Project Files

- `.env.example` - example environment variables for ROS bridge configuration

- `docker-compose.yml` - container orchestration for the web UI

- `Dockerfile` - builds the Python service image

- `requirements.txt` - Python dependencies

- `app/static/chat_messages.json` - chat options displayed in the UI (Change the messages you want to quick send in this file)