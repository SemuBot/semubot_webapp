import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from api import robot

app = FastAPI(title="SemuBot WebApp")

# Always revalidate, so phones never drive the robot with stale control code
@app.middleware("http")
async def no_cache(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache"
    return response

# API routes for robot control and status
app.include_router(robot.router, prefix="/api/robot")

# Serve static files
app.mount("/static", StaticFiles(directory="app/static"))

# Serve the frontend for the webapp
@app.get("/")
def index():
    return FileResponse("app/static/index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)