const express = require('express')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())
let db = null
const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')
const initaliseDBAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running at PORT 3000')
    })
  } catch (e) {
    console.log('Error is ${e.message}')
    process.exit(-1)
  }
}
initaliseDBAndServer()
const stateObjectTorepsonseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}
const districtObjectToResponseObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

//Authenticate Toke
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}
//Login
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `
    SELECT * FROM user
    WHERE username = '${username}';
  `
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatch === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})
//Get all state lists
app.get('/states/', authenticateToken, async (request, response) => {
  const getStateListQuery = `
    SELECT * FROM state;
  `
  const getState = await db.all(getStateListQuery)
  response.send(
    getState.map(eachState => stateObjectTorepsonseObject(eachState)),
  )
})
//Get state details based on state ID
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
    SELECT * FROM state
    WHERE state_id = ${stateId};
  `
  const state = await db.get(getStateQuery)
  response.send(stateObjectTorepsonseObject(state))
})
//POST the district in the district table
app.post('/districts/', authenticateToken, async (request, response) => {
  const districtDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails
  const createDistrictQuery = `
    INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
    VALUES (
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
    );
  `
  await db.run(createDistrictQuery)
  response.send('District Successfully Added')
})

//Get the district based on district ID
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `
    SELECT * FROM district
    WHERE district_id = ${districtId};
  `
    const district = await db.get(getDistrictQuery)
    response.send(districtObjectToResponseObject(district))
  },
)
//DELETE a district based on district ID
app.delete(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
    DELETE FROM district
    WHERE district_id = ${districtId};
  `
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

//Update the details of a district ID
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const deleteDistrictQuery = `
    update district
    set 
    district_name ='${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths};
  `
    await db.run(deleteDistrictQuery)
    response.send('District Details Updated')
  },
)
//return total cases in a state
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const totalCaseQuery = `
    SELECT SUM(cases) as totalCases,SUM(cured) as totalCured,SUM(active) as totalActive,SUM(deaths) as totalDeaths FROM district
    where state_id = '${stateId}';
  `
    const total = await db.get(totalCaseQuery)
    response.send(total)
  },
)

module.exports = app
