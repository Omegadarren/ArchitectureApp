-- Test SQL to check signature columns
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Contracts'
ORDER BY ORDINAL_POSITION;

-- Check if we have any contracts
SELECT TOP 5 ContractID, ContractNumber, ContractStatus, SignedDate,
       ContractorSignature, ClientSignature, ContractorSignatureDate, ClientSignatureDate
FROM Contracts;
