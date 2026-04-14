
DB_USER = postgres
DB_PASS = cW3EADp8

start:
	export DATABASE_URL="postgresql+psycopg2://$(DB_USER):$(DB_PASS)@localhost:5432/morphing"; \
	uvicorn morphing.main:app --reload --host 127.0.0.1 --port 8000

