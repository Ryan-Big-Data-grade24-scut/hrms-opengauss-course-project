import os


APP_HOST = os.getenv("HRMS_BACKEND_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("HRMS_BACKEND_PORT", "18080"))

DOCKER_CONTAINER = os.getenv("HRMS_DB_CONTAINER", "opengauss-hrms")
DB_NAME = os.getenv("HRMS_DB_NAME", "hrms")
DB_USER = os.getenv("HRMS_DB_USER", "hrms_app")
DB_PASSWORD = os.getenv("HRMS_DB_PASSWORD", "HRMS_App_2026!")
DB_HOST = os.getenv("HRMS_DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("HRMS_DB_PORT", "5432")
