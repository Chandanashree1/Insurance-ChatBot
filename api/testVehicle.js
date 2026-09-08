require("dotenv").config();

const { getVehicle } = require("./services/oracleservice");

async function test() {

    try {

        const vehicle = await getVehicle("61460", "M");

        console.log("========== VEHICLE RESULT ==========");
        console.log(vehicle);

    } catch (error) {

        console.error("Vehicle test failed:", error);

    }

}

test();