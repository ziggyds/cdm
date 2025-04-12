FROM python:3.13-slim
WORKDIR /app
COPY ddm.py ./
COPY db_configs.json ./
COPY static ./static
COPY requirements.txt ./
RUN pip install -r requirements.txt
EXPOSE 5000

CMD ["python", "cdm.py"]
