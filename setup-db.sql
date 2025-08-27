-- Script para configurar o banco de dados
CREATE USER mlagent WITH PASSWORD 'mlagent123';
CREATE DATABASE ml_agent OWNER mlagent;
GRANT ALL PRIVILEGES ON DATABASE ml_agent TO mlagent;