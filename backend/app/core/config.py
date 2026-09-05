import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "DRISHYAM"
    ENV: str = os.getenv("ENV", "development")

    # --- Database: Supabase-first, SQLite local fallback ---
    SUPABASE_DB_HOST: str = os.getenv("SUPABASE_DB_HOST", "")
    SUPABASE_DB_PORT: str = os.getenv("SUPABASE_DB_PORT", "5432")
    SUPABASE_DB_NAME: str = os.getenv("SUPABASE_DB_NAME", "postgres")
    SUPABASE_DB_USER: str = os.getenv("SUPABASE_DB_USER", "postgres")
    SUPABASE_DB_PASSWORD: str = os.getenv("SUPABASE_DB_PASSWORD", "")
    SUPABASE_DB_SSLMODE: str = os.getenv("SUPABASE_DB_SSLMODE", "require")

    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    @property
    def DATABASE_URL(self) -> str:
        if self.SUPABASE_DB_HOST and self.SUPABASE_DB_PASSWORD:
            return (
                f"postgresql+psycopg2://{self.SUPABASE_DB_USER}:{self.SUPABASE_DB_PASSWORD}"
                f"@{self.SUPABASE_DB_HOST}:{self.SUPABASE_DB_PORT}/{self.SUPABASE_DB_NAME}"
                f"?sslmode={self.SUPABASE_DB_SSLMODE}"
            )
        # Local fallback so the project runs with zero external setup.
        return "sqlite:///./drishyam_local.db"

    @property
    def USING_SUPABASE(self) -> bool:
        return bool(self.SUPABASE_DB_HOST and self.SUPABASE_DB_PASSWORD)

    # --- AI provider abstraction ---
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "template")  # template | groq | gemini | openai
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # --- Auth & Session Security ---
    JWT_SECRET: str = os.getenv("JWT_SECRET", "drishyam-dev-secret-change-me")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 30  # Strict 30-minute session timeout

    # --- Seed control ---
    AUTO_SEED: bool = os.getenv("AUTO_SEED", "true").lower() == "true"

    class Config:
        env_file = ".env"


settings = Settings()
