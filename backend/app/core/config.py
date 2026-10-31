from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = ""
    google_routes_api_key: str = ""
    admin_username: str = "admin"
    admin_password_hash: str = ""
    secret_key: str = ""
    cors_origins: str = "https://ansartaxiservice.onrender.com"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
