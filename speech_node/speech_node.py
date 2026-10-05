import rclpy
from rclpy.node import Node
from std_msgs.msg import String
import subprocess


class SpeechNode(Node):
    def __init__(self):
        super().__init__('speech_node')

        # Subscribe to a topic called "speech_input"
        self.subscription = self.create_subscription(
            String,
            'speech_input',
            self.listener_callback,
            10
        )

        self.get_logger().info("Speech node started. Waiting for messages...")

    def listener_callback(self, msg: String):
        text = msg.data

        self.get_logger().info(f"Received text: {text}")

        # Run the command: speak "<text>"
        try:
            subprocess.run(
                ['speak', text],
                check=True
            )
        except subprocess.CalledProcessError as e:
            self.get_logger().error(f"Failed to execute speak command: {e}")


def main(args=None):
    rclpy.init(args=args)
    node = SpeechNode()

    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()