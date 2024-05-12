# Configurations for Gunicorn in production

from multiprocessing import cpu_count

# Socket Path
bind = 'unix:/app/gunicorn.sock'

# Worker Options
workers = cpu_count() + 1
worker_class = 'uvicorn.workers.UvicornWorker'

# Logging Options
loglevel = 'info'
accesslog = '/app/access_log'
errorlog = '/app/error_log'
