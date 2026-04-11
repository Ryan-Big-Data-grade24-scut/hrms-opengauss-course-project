import os


APP_HOST = os.getenv("HRMS_BACKEND_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("HRMS_BACKEND_PORT", "8080"))

DOCKER_CONTAINER = os.getenv("HRMS_DB_CONTAINER", "opengauss-hrms")
DB_NAME = os.getenv("HRMS_DB_NAME", "hrms")
DB_USER = os.getenv("HRMS_DB_USER", "omm")
DB_PASSWORD = os.getenv("HRMS_DB_PASSWORD", "OpenGauss123!")
DB_HOST = os.getenv("HRMS_DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("HRMS_DB_PORT", "5432")
