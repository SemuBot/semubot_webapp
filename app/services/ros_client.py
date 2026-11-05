import math
import roslibpy
import os

# Get the variables from the docker-compose.yml
ROSBRIDGE_HOST = os.getenv("ROSBRIDGE_HOST", "localhost") # Default ip is localhost
ROSBRIDGE_PORT = int(os.getenv("ROSBRIDGE_PORT", 9090)) # Default port is 9090

# NaN (or a missing value) can't go into the /status JSON, so it becomes None
def _number(value):
    return value if isinstance(value, (int, float)) and not math.isnan(value) else None


class ROSClient:
    def __init__(self):
        self.ros = roslibpy.Ros(host=ROSBRIDGE_HOST, port=ROSBRIDGE_PORT)
        try:
            self.ros.run()
        except roslibpy.core.RosTimeoutError:
            # ponytail: start without ROS so the UI loads; roslibpy keeps retrying in the background
            print(f"WARNING: rosbridge not reachable at ws://{ROSBRIDGE_HOST}:{ROSBRIDGE_PORT}, retrying in background")

        # Create persistent publishers to avoid creating new ones everytime
        self.cmd_vel_pub = roslibpy.Topic(
            self.ros, '/cmd_vel', 'geometry_msgs/Twist'
        )

        self.speech_pub = roslibpy.Topic(
            self.ros, '/speech_input', 'std_msgs/String'
        )

        self.emergency_stop_pub = roslibpy.Topic(
            self.ros, '/emergency_stop', 'std_msgs/Bool'
        )

        self.mode_pub = roslibpy.Topic(
            self.ros, '/semubot/mode', 'std_msgs/String'
        )

        # Battery from the Pi's battery_monitor node (INA260), None until it reports
        self.battery_level = None
        self.battery_voltage = None
        self.battery_sub = roslibpy.Topic(self.ros, '/semubot/battery', 'sensor_msgs/BatteryState')
        self.battery_sub.subscribe(self._battery_callback)

        # Speech mode as reported by the brain node (None until it reports)
        self.mode = None
        self.mode_state_sub = roslibpy.Topic(self.ros, '/semubot/mode_state', 'std_msgs/String')
        self.mode_state_sub.subscribe(self._mode_state_callback)

        if self.ros.is_connected:
            print(f"Connected to rosbridge at ws://{ROSBRIDGE_HOST}:{ROSBRIDGE_PORT}")

    # Helper function that returns the status of the connection and the robots battery level
    def get_status(self):
        return {
            "connected": self.ros.is_connected,
            "battery": self.battery_level, #Frontend expects values from 0.0 to 1.0
            "voltage": self.battery_voltage,
            "mode": self.mode
        }

    def _battery_callback(self, message):
        self.battery_level = _number(message.get('percentage'))
        self.battery_voltage = _number(message.get('voltage'))

    def _mode_state_callback(self, message):
        self.mode = message['data']

    # Helper function that publishes the joystick values to the robot
    def publish_cmd_vel(self, linear_x=0.0, linear_y=0.0, angular_z=0.0):
        msg = roslibpy.Message({
            'linear': {'x': linear_x, 'y': linear_y, 'z': 0.0},
            'angular': {'x': 0.0, 'y': 0.0, 'z': angular_z},
        })

        # Don't queue motion while disconnected, it would fire on reconnect
        if not self.ros.is_connected:
            print("Skipped cmd_vel: not connected")
            return
        self.cmd_vel_pub.publish(msg)

        print(f"Published cmd_vel: {linear_x}, {linear_y}, {angular_z}")

    # Helper function that publishes the selected message to the speech node on the robot
    def publish_speech(self, text):
        msg = roslibpy.Message({'data': text})
        self.speech_pub.publish(msg)

        print(f"Published speech: {text}")

    # Helper function that asks the brain node to switch speech mode (manual/local/cloud)
    def publish_mode(self, mode):
        self.mode_pub.publish(roslibpy.Message({'data': mode}))
        print(f"Published mode: {mode}")

    # Helper function for emergency stop
    def publish_emergency_stop(self):
        msg = roslibpy.Message({'data': True})
        self.emergency_stop_pub.publish(msg)
        print("Published emergency stop")

    def close(self):
        self.cmd_vel_pub.unadvertise()
        self.speech_pub.unadvertise()
        self.emergency_stop_pub.unadvertise()
        self.mode_pub.unadvertise()
        self.battery_sub.unsubscribe()
        self.mode_state_sub.unsubscribe()
        self.ros.terminate()