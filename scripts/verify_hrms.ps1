$ErrorActionPreference = "Stop"

$container = "opengauss-hrms"
$gsql = "/usr/local/opengauss/bin/gsql"
$lib = "/usr/local/opengauss/lib"
$password = "OpenGauss123!"

Write-Host "Verifying hrms database..."

docker exec -e LD_LIBRARY_PATH=$lib $container $gsql -h 127.0.0.1 -p 5432 -d hrms -U omm -W $password -c "select count(*) as users from sys_user;"
docker exec -e LD_LIBRARY_PATH=$lib $container $gsql -h 127.0.0.1 -p 5432 -d hrms -U omm -W $password -c "select count(*) as departments from department;"
docker exec -e LD_LIBRARY_PATH=$lib $container $gsql -h 127.0.0.1 -p 5432 -d hrms -U omm -W $password -c "select count(*) as employees from employee;"
docker exec -e LD_LIBRARY_PATH=$lib $container $gsql -h 127.0.0.1 -p 5432 -d hrms -U omm -W $password -c "select count(*) as leaves from leave_request;"

Write-Host ""
Write-Host "Sample employee data:"
docker exec -e LD_LIBRARY_PATH=$lib $container $gsql -h 127.0.0.1 -p 5432 -d hrms -U omm -W $password -c "select employee_no, full_name, employment_status from employee order by employee_no;"

Write-Host ""
Write-Host "Verification completed."
