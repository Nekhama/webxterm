#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
webXTerm development server startup script
"""

import os
import sys
import subprocess
import argparse
import signal
import time
import logging
from pathlib import Path

# Add app to Python path
script_dir = os.path.dirname(os.path.abspath(__file__))
app_path = os.path.join(script_dir, "app")
frontend_path = os.path.join(script_dir, "frontend")
sys.path.insert(0, script_dir)  # Add root directory to path

def get_default_paths():
    """Get default paths for webXTerm"""
    base_dir = Path(__file__).parent
    data_dir = base_dir / "data"

    return {
        "log_file": str(data_dir / "webxterm.log"),
        "pid_file": str(data_dir / "webxterm.pid"),
        "args_file": str(data_dir / "webxterm.args")
    }

def setup_logging(log_level="warning", log_file=None, daemon_mode=False):
    """Setup logging"""
    level_map = {
        'debug': logging.DEBUG,
        'info': logging.INFO,
        'warning': logging.WARNING,
        'error': logging.ERROR,
        'critical': logging.CRITICAL
    }

    log_level_obj = level_map.get(log_level.lower(), logging.WARNING)

    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    logger = logging.getLogger()
    logger.setLevel(log_level_obj)

    # Clear existing handlers
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)

    if daemon_mode and log_file:
        # Daemon mode: write to log file
        try:
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            handler = logging.FileHandler(log_file)
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        except Exception as e:
            # Fallback to current directory
            fallback_log = Path(__file__).parent / "webxterm.log"
            handler = logging.FileHandler(fallback_log)
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.error(f"Cannot write to log file {log_file}: {e}, using fallback {fallback_log}")
    else:
        # Foreground mode: output to console
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import uvicorn
        import fastapi
        import paramiko
        import telnetlib3
        print("✅ All required dependencies are installed")
        return True
    except ImportError as e:
        print("❌ Missing dependency: {}".format(e))
        print("Please install dependencies with: pip install -r requirements.txt")
        return False

def check_pid_file(pid_file):
    """Check if PID file exists and process is running"""
    if not os.path.exists(pid_file):
        return None

    try:
        with open(pid_file, 'r') as f:
            pid = int(f.read().strip())

        # Check if process exists
        try:
            os.kill(pid, 0)
            return pid
        except OSError:
            # Process doesn't exist, clean up invalid PID file
            os.remove(pid_file)
            return None
    except (ValueError, IOError):
        return None

def write_pid_file(pid_file, pid):
    """Write PID file"""
    try:
        pid_file = os.path.abspath(pid_file)
        os.makedirs(os.path.dirname(pid_file), exist_ok=True)
        with open(pid_file, 'w') as f:
            f.write(str(pid))
        return True
    except IOError as e:
        logger = logging.getLogger()
        logger.error(f"Cannot write PID file {pid_file}: {e}")
        return False

def remove_pid_file(pid_file):
    """Remove PID file"""
    try:
        if os.path.exists(pid_file):
            os.remove(pid_file)
    except IOError:
        pass

def daemonize(log_file=None):
    """Daemonize the process"""
    logger = logging.getLogger()

    try:
        # First fork
        pid = os.fork()
        if pid > 0:
            sys.exit(0)
    except OSError as e:
        logger.error(f"First fork failed: {e}")
        sys.exit(1)

    # Detach from parent environment
    try:
        os.chdir('/')
        os.setsid()
        os.umask(0)
        logger.info("Successfully detached from parent environment")
    except Exception as e:
        logger.error(f"Failed to detach from parent environment: {e}")
        sys.exit(1)

    try:
        # Second fork
        pid = os.fork()
        if pid > 0:
            sys.exit(0)
    except OSError as e:
        logger.error(f"Second fork failed: {e}")
        sys.exit(1)

    # Redirect standard file descriptors
    try:
        sys.stdout.flush()
        sys.stderr.flush()

        # Redirect stdin to /dev/null
        with open('/dev/null', 'r') as f:
            os.dup2(f.fileno(), sys.stdin.fileno())

        # Redirect stdout/stderr to log file or /dev/null
        if log_file:
            try:
                os.makedirs(os.path.dirname(log_file), exist_ok=True)
                with open(log_file, 'a') as f:
                    os.dup2(f.fileno(), sys.stdout.fileno())
                    os.dup2(f.fileno(), sys.stderr.fileno())
                logger.info(f"Standard output redirected to: {log_file}")
            except Exception as e:
                logger.error(f"Failed to redirect to log file: {e}")
                with open('/dev/null', 'w') as f:
                    os.dup2(f.fileno(), sys.stdout.fileno())
                    os.dup2(f.fileno(), sys.stderr.fileno())
        else:
            with open('/dev/null', 'w') as f:
                os.dup2(f.fileno(), sys.stdout.fileno())
                os.dup2(f.fileno(), sys.stderr.fileno())

        logger.info("Daemonization completed")
    except Exception as e:
        logger.error(f"Failed to redirect standard file descriptors: {e}")
        sys.exit(1)

def stop_daemon(pid_file):
    """Stop daemon process"""
    pid = check_pid_file(pid_file)
    if not pid:
        print("❌ Process is not running")
        return False

    try:
        print(f"🛑 Stopping process {pid}...")
        os.kill(pid, signal.SIGTERM)

        # Wait for process to stop
        for _ in range(30):  # Wait up to 30 seconds
            try:
                os.kill(pid, 0)
                time.sleep(1)
            except OSError:
                print("✅ Process stopped")
                remove_pid_file(pid_file)
                return True

        # Force stop
        print("⚠️  Process didn't respond to SIGTERM, using SIGKILL...")
        try:
            os.kill(pid, signal.SIGKILL)
            time.sleep(2)

            try:
                os.kill(pid, 0)
                print("❌ Cannot stop process")
                return False
            except OSError:
                print("✅ Process forcefully stopped")
                remove_pid_file(pid_file)
                return True
        except OSError:
            print("✅ Process stopped")
            remove_pid_file(pid_file)
            return True

    except ProcessLookupError:
        print("✅ Process already stopped")
        remove_pid_file(pid_file)
        return True
    except PermissionError:
        print("❌ Insufficient permissions to stop process")
        return False

def save_start_args(args_file, args):
    """Save startup arguments for restart"""
    try:
        os.makedirs(os.path.dirname(args_file), exist_ok=True)
        with open(args_file, 'w') as f:
            f.write(f"port={args.port}\n")
            f.write(f"debug={args.debug}\n")
            f.write(f"verb={args.verb}\n")
            f.write(f"daemon={args.daemon}\n")
            f.write(f"pid_file={args.pid_file}\n")
            if args.log_file:
                f.write(f"log_file={args.log_file}\n")
        return True
    except Exception as e:
        logging.error(f"Cannot save args file {args_file}: {e}")
        return False

def load_start_args(args_file):
    """Load startup arguments for restart"""
    if not os.path.exists(args_file):
        return None

    try:
        args = {}
        with open(args_file, 'r') as f:
            for line in f:
                if '=' in line:
                    key, value = line.strip().split('=', 1)
                    if key in ['debug', 'verb', 'daemon']:
                        args[key] = value.lower() == 'true'
                    elif key == 'port':
                        args[key] = int(value)
                    else:
                        args[key] = value
        return args
    except Exception as e:
        logging.error(f"Cannot load args file {args_file}: {e}")
        return None

def restart_daemon(args_file, pid_file):
    """Restart daemon with saved arguments"""
    # Load saved arguments
    saved_args = load_start_args(args_file)
    if not saved_args:
        print("❌ No saved arguments found. Cannot restart.")
        return False

    print("🔄 Restarting webXTerm daemon...")
    print(f"   Using saved arguments: port={saved_args.get('port', 8080)}, debug={saved_args.get('debug', False)}")

    # Stop current daemon
    if not stop_daemon(pid_file):
        print("⚠️  Warning: Failed to stop existing daemon, attempting to start anyway...")

    # Wait a moment for cleanup
    time.sleep(2)

    # Start with saved arguments
    log_level = "warning"
    if saved_args.get('debug', False):
        log_level = "debug"
    elif saved_args.get('verb', False):
        log_level = "info"

    logger = setup_logging(log_level, daemon_mode=False)
    success = start_daemon(
        saved_args.get('pid_file', pid_file),
        port=saved_args.get('port', 8080),
        log_level=log_level,
        log_file=saved_args.get('log_file')
    )

    if success:
        print("✅ webXTerm daemon restarted successfully")
    else:
        print("❌ Failed to restart webXTerm daemon")

    return success

def start_daemon(pid_file, port=8080, log_level="warning", log_file=None):
    """Start daemon process"""
    logger = logging.getLogger()

    # Save current working directory
    app_dir = os.getcwd()

    # Convert to absolute paths
    pid_file = os.path.abspath(pid_file)
    if log_file:
        log_file = os.path.abspath(log_file)

    # Check if already running
    existing_pid = check_pid_file(pid_file)
    if existing_pid:
        print(f"❌ webXTerm is already running (PID: {existing_pid})")
        return False

    print("🚀 Starting webXTerm daemon...")
    logger.info(f"Starting daemon, app directory: {app_dir}")

    try:
        child_pid = os.fork()
        if child_pid == 0:
            # Child process
            child_app_dir = app_dir

            try:
                # Setup logging for daemon
                daemon_logger = setup_logging(log_level, log_file, daemon_mode=True)
                daemon_logger.info(f"Child process starting daemonization, app directory: {child_app_dir}")

                # Daemonize
                daemonize(log_file)

                # Write PID file
                current_pid = os.getpid()
                daemon_logger.info(f"Daemon PID: {current_pid}")

                if not write_pid_file(pid_file, current_pid):
                    daemon_logger.error(f"Cannot write PID file: {pid_file}")
                    sys.exit(1)

                daemon_logger.info(f"PID file written: {pid_file}")

                # Setup signal handlers
                def signal_handler(signum, frame):
                    daemon_logger.info(f"Received signal: {signum}")
                    if signum == signal.SIGTERM:
                        daemon_logger.info("Received SIGTERM, stopping...")
                        remove_pid_file(pid_file)
                        sys.exit(0)

                signal.signal(signal.SIGTERM, signal_handler)
                daemon_logger.info("Signal handlers setup completed")

                # Start webXTerm service
                daemon_logger.info(f"Starting webXTerm service, working directory: {child_app_dir}")
                start_server(port, log_level, daemon_mode=True, app_dir=child_app_dir)

            except Exception as e:
                if 'daemon_logger' in locals():
                    daemon_logger.error(f"Daemon startup failed: {e}")
                else:
                    logging.error(f"Daemon startup failed: {e}")
                sys.exit(1)
        else:
            # Parent process
            logger.info(f"Parent process waiting for child startup (child PID: {child_pid})")
            time.sleep(3)  # Give more time for child process initialization

            pid = check_pid_file(pid_file)
            if pid:
                print(f"✅ webXTerm daemon started (PID: {pid})")
                print(f"📝 webXTerm: http://127.0.0.1:{port}")
                print(f"📝 API Docs: http://127.0.0.1:{port}/docs")
                if log_file:
                    print(f"📝 Log file: {log_file}")
                logger.info(f"Daemon startup successful (PID: {pid})")
                return True
            else:
                print("❌ Daemon startup failed, check log file")
                logger.error("Daemon startup failed")
                return False

    except OSError as e:
        logger.error(f"Fork failed: {e}")
        print(f"❌ Fork failed: {e}")
        return False

def start_server(port=8080, log_level="warning", daemon_mode=False, app_dir=None):
    """Start webXTerm server (FastAPI handles both frontend and backend)"""
    if not check_dependencies():
        if not daemon_mode:
            sys.exit(1)
        else:
            return

    if not daemon_mode:
        print(f"\n🚀 Starting webXTerm server...")
        print(f"   webXTerm: http://127.0.0.1:{port}")
        print(f"   API Docs: http://127.0.0.1:{port}/docs")
        print(f"\n   Press Ctrl+C to stop the server\n")

    # Set environment variables
    os.environ["ENVIRONMENT"] = "development"
    if log_level == "debug":
        os.environ["DEBUG"] = "true"

    # In daemon mode, switch to app directory, otherwise stay in root
    if daemon_mode and app_dir:
        os.chdir(app_dir)
    else:
        # Ensure we're in the project root directory
        os.chdir(script_dir)

    # Start uvicorn server (app is now in root directory)
    cmd = [
        sys.executable, "-m", "uvicorn",
        "app.main:app",
        "--host", "127.0.0.1",
        "--port", str(port),
        "--log-level", log_level
    ]

    # 在debug模式下，确保应用程序日志级别也是debug
    if log_level == "debug":
        logging.getLogger().setLevel(logging.DEBUG)
        # 设置所有相关模块的日志级别
        for module_name in ['app.api.connections', 'app.services.connection_manager', 'app.protocols.telnet']:
            logging.getLogger(module_name).setLevel(logging.DEBUG)

    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        if not daemon_mode:
            print("\n✅ webXTerm server stopped")
    except Exception as e:
        logger = logging.getLogger()
        logger.error(f"Failed to start server: {e}")
        if not daemon_mode:
            print(f"❌ Failed to start server: {e}")
        sys.exit(1)

def main():
    defaults = get_default_paths()

    parser = argparse.ArgumentParser(description="Start webXTerm development server")
    parser.add_argument("--port", type=int, default=8080, help="Port to bind to (default: 8080)")
    parser.add_argument("--debug", action="store_true", help="Set log level to debug")
    parser.add_argument("--verb", action="store_true", help="Set log level to info")
    parser.add_argument("--daemon", action="store_true", help="Run as daemon")
    parser.add_argument("--pid-file", default=defaults["pid_file"], help=f"PID file path (default: {defaults['pid_file']})")
    parser.add_argument("--log-file", help="Log file path")
    parser.add_argument("--stop", action="store_true", help="Stop daemon")
    parser.add_argument("--restart", action="store_true", help="Restart daemon with same arguments")

    args = parser.parse_args()

    # Determine log level
    log_level = "warning"  # default
    if args.debug:
        log_level = "debug"
    elif args.verb:
        log_level = "info"

    # Set default log file if in daemon mode
    if args.daemon and not args.log_file:
        args.log_file = defaults["log_file"]

    # Setup logging for foreground mode
    if not args.daemon:
        setup_logging(log_level, daemon_mode=False)

    # Handle stop command
    if args.stop:
        stop_daemon(args.pid_file)
        return

    # Handle restart command
    if args.restart:
        restart_daemon(defaults["args_file"], args.pid_file)
        return

    print("🚀 webXTerm Server")
    print("=" * 40)

    if args.daemon:
        # Save arguments for future restart
        save_start_args(defaults["args_file"], args)

        # Daemon mode
        logger = setup_logging(log_level, daemon_mode=False)
        success = start_daemon(
            args.pid_file,
            port=args.port,
            log_level=log_level,
            log_file=args.log_file
        )
        if not success:
            sys.exit(1)
    else:
        # Foreground mode
        # Check if daemon is already running
        existing_pid = check_pid_file(args.pid_file)
        if existing_pid:
            print(f"⚠️  Daemon is already running (PID: {existing_pid})")
            print(f"   To stop: python start.py --stop")
            print()

        # Start server in foreground
        start_server(
            port=args.port,
            log_level=log_level,
            daemon_mode=False
        )

if __name__ == "__main__":
    main()
