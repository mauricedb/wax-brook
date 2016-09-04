// From http://thomasv.nl/2014/03/rd-naar-gps/

const X0      = 155000
const Y0      = 463000
const phi0    = 52.15517440
const lam0    = 5.38720621

module.exports = {
    fromRdToWgs: coords => {

        var Kp = [0,2,0,2,0,2,1,4,2,4,1]
        var Kq = [1,0,2,1,3,2,0,0,3,1,1]
        var Kpq = [3235.65389,-32.58297,-0.24750,-0.84978,-0.06550,-0.01709,-0.00738,0.00530,-0.00039,0.00033,-0.00012]

        var Lp = [1,1,1,3,1,3,0,3,1,0,2,5]
        var Lq = [0,1,2,0,3,1,1,2,4,2,0,0]
        var Lpq = [5260.52916,105.94684,2.45656,-0.81885,0.05594,-0.05607,0.01199,-0.00256,0.00128,0.00022,-0.00022,0.00026]

        var dX = 1E-5 * ( coords[0] - X0 )
        var dY = 1E-5 * ( coords[1] - Y0 )
        
        var phi = 0
        var lam = 0

        // for k in range(len(Kpq)):
        for (var k = 0; k < Kpq.length; k++)
            phi = phi + ( Kpq[k] * Math.pow(dX, Kp[k]) * Math.pow(dY, Kq[k]) )
        phi = phi0 + phi / 3600

        // for l in range(len(Lpq)):
        for (var l = 0; l < Lpq.length; l++)
            lam = lam + ( Lpq[l] * Math.pow(dX, Lp[l]) * Math.pow(dY, Lq[l]) )
        lam = lam0 + lam / 3600

        return [phi,lam]

    }
}