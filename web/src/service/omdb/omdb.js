import axios from 'axios';

const OMDB_BASEURL = import.meta.env.VITE_OMDB_BASEURL;

const omdbInstance = axios.create({
  baseURL: OMDB_BASEURL,
})

export default omdbInstance;