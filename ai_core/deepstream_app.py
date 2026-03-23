import os
import sys
from loguru import logger

def setup_logging():
    """Configures the Loguru logger for the application."""
    log_level = os.getenv("LOG_LEVEL", "DEBUG")
    logger.remove()
    logger.add(
        sys.stdout, 
        colorize=True, 
        level=log_level,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
    )
    
    os.makedirs("logs", exist_ok=True)
    logger.add("logs/app.log", rotation="50 MB", retention=5, level=log_level)

def main():
    """
    Initializes and runs the DeepStream application.
    This script now acts as a simple entry point.
    """
    setup_logging()
    
    # It's crucial to import the main app class after loading .env
    # The main_app.py itself handles loading dotenv.
    try:
        from deepstream_manager.main_app import DeepStreamApp
    except ImportError as e:
        logger.critical(f"Failed to import the main application module. Ensure all dependencies are installed.")
        logger.critical(f"Import Error: {e}")
        sys.exit(1)
        
    app = DeepStreamApp()
    app.run()

if __name__ == "__main__":
    main()
